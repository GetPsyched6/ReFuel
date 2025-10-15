"""
AI service - Watsonx REST API integration for insights and chatbot
Uses direct REST API instead of SDK for better control
"""
from typing import Dict, List, Optional
import json
import re
from datetime import datetime, timedelta
import httpx

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import settings
from models.database import db


class WatsonxTokenManager:
    """Manages Watsonx IAM token with auto-refresh"""
    
    def __init__(self):
        self.token = None
        self.token_expiry = None
    
    async def get_token(self) -> str:
        """Get valid token, refresh if needed"""
        if self.token and self.token_expiry and datetime.now() < self.token_expiry:
            return self.token
        
        # Request new token
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://iam.cloud.ibm.com/identity/token",
                data={
                    "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
                    "apikey": settings.WATSONX_API_KEY
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.token = data["access_token"]
                # Token expires in 1 hour, refresh 5 minutes before
                self.token_expiry = datetime.now() + timedelta(seconds=data.get("expires_in", 3600) - 300)
                return self.token
            else:
                raise Exception(f"Failed to get token: {response.status_code}")


class AIService:
    """Service for AI-powered insights using Watsonx REST API"""
    
    def __init__(self):
        self.api_key = settings.WATSONX_API_KEY
        self.project_id = settings.WATSONX_PROJECT_ID
        self.model = settings.WATSONX_MODEL
        self.base_url = settings.WATSONX_URL
        self.token_manager = WatsonxTokenManager() if self.api_key else None
    
    async def _call_watsonx(self, prompt: str, max_tokens: int = 500, temperature: float = 0.7) -> str:
        """Call Watsonx API with prompt"""
        if not self.token_manager:
            raise Exception("Watsonx API key not configured")
        
        token = await self.token_manager.get_token()
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url}/ml/v1/text/generation?version=2023-05-29",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                json={
                    "model_id": self.model,
                    "input": prompt,
                    "parameters": {
                        "max_new_tokens": max_tokens,
                        "temperature": temperature,
                        "decoding_method": "greedy"
                    },
                    "project_id": self.project_id
                }
            )
            
            if response.status_code != 200:
                raise Exception(f"Watsonx API error: {response.status_code} - {response.text}")
            
            result = response.json()
            
            # Extract generated text from response
            if "results" in result and len(result["results"]) > 0:
                return result["results"][0].get("generated_text", "")
            
            return ""
    
    def _parse_json_aggressive(self, text: str) -> Optional[Dict]:
        """Aggressively parse JSON from text with multiple fallback strategies"""
        if not text:
            return None
        
        json_str = text.strip()
        
        # Strategy 1: Handle markdown code blocks
        if "```" in json_str:
            code_block_match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", json_str, re.DOTALL)
            if code_block_match:
                json_str = code_block_match.group(1).strip()
        
        # Strategy 2: Extract JSON if surrounded by text
        if not json_str.startswith("{"):
            start_idx = json_str.find("{")
            if start_idx != -1:
                json_str = json_str[start_idx:]
        
        if not json_str.endswith("}"):
            end_idx = json_str.rfind("}") + 1
            if end_idx > 0:
                json_str = json_str[:end_idx]
        
        # Strategy 3: Unescape JSON
        if "\\{" in json_str or "\\}" in json_str or "\\[" in json_str or "\\]" in json_str:
            json_str = json_str.replace("\\{", "{").replace("\\}", "}")
            json_str = json_str.replace("\\[", "[").replace("\\]", "]")
            json_str = json_str.replace('\\"', '"')
        
        # Strategy 3.5: Balance curly braces (add missing closing braces)
        if json_str.startswith("{"):
            open_count = json_str.count("{")
            close_count = json_str.count("}")
            if open_count > close_count:
                missing_braces = open_count - close_count
                json_str += "}" * missing_braces
                print(f"Added {missing_braces} missing closing brace(s)")
        
        # Strategy 4: Try to parse
        try:
            if json_str.startswith("{") and json_str.endswith("}"):
                return json.loads(json_str)
        except json.JSONDecodeError:
            pass
        
        # Strategy 5: Try to fix common issues
        try:
            # Remove trailing commas
            json_str = re.sub(r',\s*}', '}', json_str)
            json_str = re.sub(r',\s*]', ']', json_str)
            return json.loads(json_str)
        except json.JSONDecodeError:
            pass
        
        return None
    
    def _parse_text_fallback(self, text: str) -> Dict:
        """Fallback text parsing for insights"""
        insights = {
            "competitive_position": {},
            "opportunities": [],
            "recommendations": [],
            "key_metrics": {}
        }
        
        lines = text.split('\n')
        current_section = None
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Detect sections
            lower = line.lower()
            if 'competitive' in lower or 'position' in lower:
                current_section = 'competitive_position'
            elif 'opportunit' in lower:
                current_section = 'opportunities'
            elif 'recommend' in lower:
                current_section = 'recommendations'
            elif 'metric' in lower:
                current_section = 'key_metrics'
            elif line.startswith('-') or line.startswith('•') or line.startswith('*'):
                # List item
                item = line.lstrip('-•* ').strip()
                if current_section == 'opportunities':
                    insights['opportunities'].append(item)
                elif current_section == 'recommendations':
                    insights['recommendations'].append(item)
        
        return insights
    
    async def generate_insights(self, session_id: int) -> Dict:
        """
        Generate AI insights for a scrape session
        Caches results in database
        """
        # Check if insights already exist
        existing = await db.execute_query(
            "SELECT * FROM ai_insights WHERE session_id = ? AND insight_type = 'summary'",
            (session_id,)
        )
        
        if existing:
            insight = existing[0]
            return {
                "id": insight['id'],
                "session_id": insight['session_id'],
                "insight_type": insight['insight_type'],
                "content": json.loads(insight['content']),
                "generated_at": insight['generated_at'],
                "model_used": insight['model_used']
            }
        
        # Get session data
        data = await db.execute_query(
            "SELECT * FROM fuel_surcharges WHERE session_id = ?",
            (session_id,)
        )
        
        # Generate insights
        if self.token_manager:
            insights = await self._generate_with_watsonx(data)
        else:
            insights = self._generate_fallback_insights(data)
        
        # Save to database
        insight_id = await db.execute_write(
            """
            INSERT INTO ai_insights (session_id, insight_type, content, model_used)
            VALUES (?, ?, ?, ?)
            """,
            (session_id, 'summary', json.dumps(insights), self.model if self.token_manager else 'fallback')
        )
        
        return {
            "id": insight_id,
            "session_id": session_id,
            "insight_type": "summary",
            "content": insights,
            "generated_at": datetime.now().isoformat(),
            "model_used": self.model if self.token_manager else 'fallback'
        }
    
    async def _generate_with_watsonx(self, data: List[Dict]) -> Dict:
        """Generate insights using Watsonx REST API"""
        # Prepare data summary
        carriers = set(d['carrier'] for d in data)
        
        summary_by_carrier = {}
        for carrier in carriers:
            carrier_data = [d for d in data if d['carrier'] == carrier]
            summary_by_carrier[carrier] = {
                "avg_surcharge": round(sum(d['surcharge_pct'] for d in carrier_data) / len(carrier_data), 2),
                "min_surcharge": min(d['surcharge_pct'] for d in carrier_data),
                "max_surcharge": max(d['surcharge_pct'] for d in carrier_data),
                "price_range": f"${min(d['at_least_usd'] for d in carrier_data):.2f}-${max(d['but_less_than_usd'] for d in carrier_data):.2f}"
            }
        
        # Construct prompt with aggressive JSON instruction
        prompt = f"""You are a logistics pricing analyst. Analyze this fuel surcharge data and provide insights for UPS.

Data Summary:
{json.dumps(summary_by_carrier, indent=2)}

Provide your analysis in STRICT JSON format. The response MUST be valid JSON with these exact keys:
- competitive_position (object)
- opportunities (array of strings)
- recommendations (array of strings)  
- key_metrics (object)

Focus on:
1. UPS competitive position vs FedEx and DHL
2. Price ranges where UPS can optimize
3. Revenue vs competitiveness trade-offs

CRITICAL: Return ONLY valid JSON. No markdown, no explanation, just JSON starting with {{"""
        
        try:
            response_text = await self._call_watsonx(prompt, max_tokens=800, temperature=0.3)
            
            # Try aggressive JSON parsing
            parsed = self._parse_json_aggressive(response_text)
            if parsed:
                return parsed
            
            # Fallback to text parsing
            return self._parse_text_fallback(response_text)
            
        except Exception as e:
            print(f"⚠️ Watsonx generation failed: {e}")
            return self._generate_fallback_insights(data)
    
    def _generate_fallback_insights(self, data: List[Dict]) -> Dict:
        """Generate basic insights without AI"""
        carriers = set(d['carrier'] for d in data)
        
        insights = {
            "competitive_position": {},
            "opportunities": [],
            "recommendations": [],
            "key_metrics": {}
        }
        
        for carrier in carriers:
            carrier_data = [d for d in data if d['carrier'] == carrier]
            avg = sum(d['surcharge_pct'] for d in carrier_data) / len(carrier_data)
            
            insights["key_metrics"][carrier] = {
                "average_surcharge": round(avg, 2),
                "min_surcharge": min(d['surcharge_pct'] for d in carrier_data),
                "max_surcharge": max(d['surcharge_pct'] for d in carrier_data),
                "data_points": len(carrier_data)
            }
        
        # Basic competitive analysis
        if 'UPS' in insights["key_metrics"]:
            ups_avg = insights["key_metrics"]['UPS']['average_surcharge']
            
            for carrier in ['FedEx', 'DHL']:
                if carrier in insights["key_metrics"]:
                    carrier_avg = insights["key_metrics"][carrier]['average_surcharge']
                    diff = ups_avg - carrier_avg
                    
                    if diff > 0:
                        insights["opportunities"].append(
                            f"UPS is {diff:.1f}% higher than {carrier} on average - potential to reduce rates"
                        )
                    else:
                        insights["competitive_position"][carrier] = f"More competitive by {abs(diff):.1f}%"
        
        insights["recommendations"] = [
            "Review price ranges where surcharges exceed competitors by >1%",
            "Consider dynamic pricing based on competitive positioning",
            "Monitor weekly trends for market changes"
        ]
        
        return insights
    
    async def chat(self, message: str, context_session_id: Optional[int] = None, history: List[Dict] = None) -> str:
        """
        Chat with AI about fuel surcharge data
        """
        # Get context data
        context = ""
        if context_session_id:
            data = await db.execute_query(
                "SELECT * FROM fuel_surcharges WHERE session_id = ? LIMIT 50",
                (context_session_id,)
            )
            context = f"\n\nCurrent fuel surcharge data:\n{json.dumps(data[:10], indent=2)}"
        
        # Build conversation
        history = history or []
        conversation = "\n".join([
            f"{msg['role'].upper()}: {msg['content']}" for msg in history[-5:]  # Last 5 messages
        ])
        
        prompt = f"""You are a helpful assistant for analyzing fuel surcharge data.

{conversation}

Context: {context}

USER: {message}
ASSISTANT:"""
        
        if self.token_manager:
            try:
                response = await self._call_watsonx(prompt, max_tokens=300, temperature=0.7)
                return response
            except Exception as e:
                return f"I'm sorry, I encountered an error: {str(e)}"
        else:
            return "AI service is not configured. Please set WATSONX_API_KEY and WATSONX_PROJECT_ID."


# Global service instance
ai_service = AIService()
