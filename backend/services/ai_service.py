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


def parse_ai_json_response(text: str) -> Optional[Dict]:
    """
    Centralized JSON parsing with all fallback strategies.
    Handles markdown code blocks, surrounding text, escaped JSON, 
    unbalanced braces, and trailing commas.
    """
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
    
    # Find the matching closing brace by counting nesting levels
    if not json_str.endswith("}"):
        brace_count = 0
        end_idx = -1
        for i, char in enumerate(json_str):
            if char == "{":
                brace_count += 1
            elif char == "}":
                brace_count -= 1
                if brace_count == 0:
                    end_idx = i + 1
                    break
        
        if end_idx > 0:
            json_str = json_str[:end_idx]
    
    # Strategy 3: Unescape JSON
    if "\\{" in json_str or "\\}" in json_str or "\\[" in json_str or "\\]" in json_str:
        json_str = json_str.replace("\\{", "{").replace("\\}", "}")
        json_str = json_str.replace("\\[", "[").replace("\\]", "]")
        json_str = json_str.replace('\\"', '"')
    
    # Strategy 4: Balance curly braces (add missing closing braces)
    if json_str.startswith("{"):
        open_count = json_str.count("{")
        close_count = json_str.count("}")
        if open_count > close_count:
            missing_braces = open_count - close_count
            json_str += "}" * missing_braces
    
    # Strategy 5: Try to parse
    try:
        if json_str.startswith("{") and json_str.endswith("}"):
            return json.loads(json_str)
    except json.JSONDecodeError:
        pass
    
    # Strategy 6: Try to fix common issues
    try:
        # Remove trailing commas
        json_str = re.sub(r',\s*}', '}', json_str)
        json_str = re.sub(r',\s*]', ']', json_str)
        return json.loads(json_str)
    except json.JSONDecodeError:
        pass
    
    return None


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
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
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
                    print(f"✓ Watsonx token refreshed successfully")
                    return self.token
                else:
                    error_msg = f"Failed to get token: {response.status_code} - {response.text}"
                    print(f"⚠️ Token error: {error_msg}")
                    raise Exception(error_msg)
        except httpx.TimeoutException:
            raise Exception("Token request timed out - check network connection")
        except Exception as e:
            print(f"⚠️ Token manager error: {e}")
            raise


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
        """Wrapper for centralized JSON parser"""
        return parse_ai_json_response(text)
    
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
        Enhanced chat with intelligent data querying
        """
        if not self.token_manager:
            return "AI service is not configured. Please check your Watsonx credentials."
        
        try:
            # Detect query type and get relevant context
            query_type = self._detect_query_type(message)
            context_data = await self._get_relevant_context(query_type, message, context_session_id)
            
            # Build conversation history
            history = history or []
            conversation = "\n".join([
                f"{msg['role'].upper()}: {msg['content']}" for msg in history[-8:]  # Last 8 messages (4 exchanges)
            ])
            
            # Build enhanced prompt with context
            prompt = f"""You are an expert fuel surcharge competitive intelligence analyst. You help analyze pricing data and provide strategic insights.

{conversation}

CURRENT DATA CONTEXT:
{context_data}

USER QUESTION: {message}

Provide a helpful, data-driven response. If referencing specific numbers, cite them accurately from the context. Be concise but insightful.

ASSISTANT:"""
            
            response = await self._call_watsonx(prompt, max_tokens=400, temperature=0.7)
            return response.strip()
            
        except Exception as e:
            print(f"⚠️ Chat error: {e}")
            return f"I apologize, I encountered an error: {str(e)}. Please try rephrasing your question."
    
    def _detect_query_type(self, message: str) -> str:
        """Detect the type of query from user message"""
        message_lower = message.lower()
        
        if any(word in message_lower for word in ['rate', 'price', 'cost', 'how much', 'percentage', '%', 'surcharge']):
            return 'rate_query'
        elif any(word in message_lower for word in ['compare', 'comparison', 'versus', 'vs', 'difference', 'between']):
            return 'comparison'
        elif any(word in message_lower for word in ['trend', 'change', 'history', 'past', 'week', 'month', 'ago']):
            return 'historical'
        elif any(word in message_lower for word in ['opportunity', 'optimize', 'improve', 'recommend', 'should']):
            return 'opportunity'
        elif any(word in message_lower for word in ['highest', 'lowest', 'cheapest', 'expensive', 'best', 'worst']):
            return 'extremes'
        else:
            return 'general'
    
    async def _get_relevant_context(self, query_type: str, message: str, session_id: Optional[int]) -> str:
        """Get relevant data based on query type"""
        if not session_id:
            return "No recent data available. Please run a scrape first."
        
        try:
            if query_type == 'rate_query':
                # Get specific rate information
                data = await db.execute_query(
                    "SELECT carrier, at_least_usd, but_less_than_usd, surcharge_pct FROM fuel_surcharges WHERE session_id = ? ORDER BY at_least_usd LIMIT 30",
                    (session_id,)
                )
                return f"Recent rates:\n{json.dumps(data[:15], indent=2)}"
            
            elif query_type == 'comparison':
                # Get comparison data
                data = await db.execute_query(
                    "SELECT carrier, AVG(surcharge_pct) as avg_pct, MIN(surcharge_pct) as min_pct, MAX(surcharge_pct) as max_pct, COUNT(*) as ranges FROM fuel_surcharges WHERE session_id = ? GROUP BY carrier",
                    (session_id,)
                )
                return f"Carrier comparison:\n{json.dumps(data, indent=2)}"
            
            elif query_type == 'extremes':
                # Get highest and lowest rates
                data = await db.execute_query(
                    """SELECT carrier, at_least_usd, but_less_than_usd, surcharge_pct 
                       FROM fuel_surcharges 
                       WHERE session_id = ? 
                       ORDER BY surcharge_pct DESC 
                       LIMIT 10""",
                    (session_id,)
                )
                lowest = await db.execute_query(
                    """SELECT carrier, at_least_usd, but_less_than_usd, surcharge_pct 
                       FROM fuel_surcharges 
                       WHERE session_id = ? 
                       ORDER BY surcharge_pct ASC 
                       LIMIT 10""",
                    (session_id,)
                )
                return f"Highest rates:\n{json.dumps(data[:5], indent=2)}\n\nLowest rates:\n{json.dumps(lowest[:5], indent=2)}"
            
            elif query_type == 'opportunity':
                # Get competitive positioning data
                data = await db.execute_query(
                    "SELECT carrier, at_least_usd, but_less_than_usd, surcharge_pct FROM fuel_surcharges WHERE session_id = ? ORDER BY carrier, at_least_usd",
                    (session_id,)
                )
                # Group by carrier for analysis
                by_carrier = {}
                for row in data:
                    carrier = row['carrier']
                    if carrier not in by_carrier:
                        by_carrier[carrier] = []
                    by_carrier[carrier].append(row)
                
                summary = {carrier: {
                    'avg': round(sum(r['surcharge_pct'] for r in rows) / len(rows), 2),
                    'count': len(rows)
                } for carrier, rows in by_carrier.items()}
                
                return f"Competitive positioning:\n{json.dumps(summary, indent=2)}\n\nSample data:\n{json.dumps(data[:10], indent=2)}"
            
            else:
                # General context - provide overview
                data = await db.execute_query(
                    "SELECT carrier, COUNT(*) as ranges, AVG(surcharge_pct) as avg_pct FROM fuel_surcharges WHERE session_id = ? GROUP BY carrier",
                    (session_id,)
                )
                return f"Data overview:\n{json.dumps(data, indent=2)}"
                
        except Exception as e:
            print(f"⚠️ Context retrieval error: {e}")
            return "Unable to retrieve specific data context."
    
    async def generate_executive_analysis(self, session_id: int) -> Dict:
        """
        Generate comprehensive executive-level analysis
        """
        if not self.token_manager:
            return self._generate_fallback_executive_analysis(session_id)
        
        try:
            # Get current session data
            data = await db.execute_query(
                "SELECT * FROM fuel_surcharges WHERE session_id = ? ORDER BY carrier, at_least_usd",
                (session_id,)
            )
            
            if not data:
                return {"error": "No data available for analysis"}
            
            # Calculate detailed metrics
            carriers = {}
            for row in data:
                carrier = row['carrier']
                if carrier not in carriers:
                    carriers[carrier] = {
                        'rates': [],
                        'ranges': []
                    }
                carriers[carrier]['rates'].append(row['surcharge_pct'])
                carriers[carrier]['ranges'].append(f"${row['at_least_usd']:.2f}-${row['but_less_than_usd']:.2f}")
            
            # Calculate summaries
            summary_data = {}
            for carrier, info in carriers.items():
                rates = info['rates']
                summary_data[carrier] = {
                    'avg': round(sum(rates) / len(rates), 2),
                    'min': round(min(rates), 2),
                    'max': round(max(rates), 2),
                    'range_count': len(rates),
                    'price_coverage': f"${data[0]['at_least_usd']:.2f}-${data[-1]['but_less_than_usd']:.2f}"
                }
            
            # Get historical context for trends
            historical_sessions = await db.execute_query(
                "SELECT id, timestamp FROM scrape_sessions WHERE id < ? ORDER BY timestamp DESC LIMIT 5",
                (session_id,)
            )
            
            trend_context = ""
            if historical_sessions:
                prev_session_id = historical_sessions[0]['id']
                prev_data = await db.execute_query(
                    "SELECT carrier, AVG(surcharge_pct) as avg_pct FROM fuel_surcharges WHERE session_id = ? GROUP BY carrier",
                    (prev_session_id,)
                )
                prev_summary = {row['carrier']: row['avg_pct'] for row in prev_data}
                
                # Calculate changes
                changes = {}
                for carrier in summary_data:
                    if carrier in prev_summary:
                        change = summary_data[carrier]['avg'] - prev_summary[carrier]
                        changes[carrier] = round(change, 2)
                
                if changes:
                    trend_context = f"\n\nRecent Changes (vs previous scrape):\n{json.dumps(changes, indent=2)}"
            
            # Construct aggressive prompt for JSON response
            prompt = f"""You are a senior logistics pricing strategist analyzing fuel surcharge competitive intelligence.

CURRENT DATA SUMMARY:
{json.dumps(summary_data, indent=2)}
{trend_context}

YOUR TASK: Generate ONLY valid JSON with this EXACT structure:

{{
  "summary": "2-3 sentence executive summary string",
  "key_findings": [
    "Finding 1 with specific numbers",
    "Finding 2 with specific data",
    "Finding 3...",
    "Finding 4..."
  ],
  "opportunities": [
    "Opportunity 1",
    "Opportunity 2",
    "Opportunity 3"
  ],
  "risks": [
    "Risk 1",
    "Risk 2"
  ],
  "trend_commentary": "2-3 sentence string about market direction"
}}

CRITICAL RULES:
- summary is a STRING (not an array)
- key_findings is an ARRAY of strings (4-5 items)
- opportunities is an ARRAY of strings (2-3 items)
- risks is an ARRAY of strings (1-2 items)
- trend_commentary is a STRING (not an array)
- Be specific with percentages from the data
- Focus on competitive positioning
- Return ONLY the JSON object, no explanatory text

Begin with {{:
{{"""
            
            response_text = await self._call_watsonx(prompt, max_tokens=1500, temperature=0.4)
            
            # Parse JSON response
            parsed = self._parse_json_aggressive(response_text)
            if parsed:
                return {
                    "analysis": parsed,
                    "metadata": {
                        "session_id": session_id,
                        "carriers_analyzed": list(summary_data.keys()),
                        "total_ranges": sum(s['range_count'] for s in summary_data.values()),
                        "generated_at": datetime.now().isoformat()
                    }
                }
            
            # Fallback if JSON parsing fails
            print(f"⚠️ Executive analysis JSON parsing failed, using fallback")
            return self._generate_fallback_executive_analysis(session_id)
            
        except Exception as e:
            print(f"⚠️ Executive analysis generation error: {e}")
            return self._generate_fallback_executive_analysis(session_id)
    
    def _generate_fallback_executive_analysis(self, session_id: int) -> Dict:
        """Generate basic executive analysis without AI"""
        return {
            "analysis": {
                "summary": "Competitive fuel surcharge data successfully collected and analyzed. All carriers show comparable rate structures with minor variations.",
                "key_findings": [
                    "Data successfully scraped from all three major carriers",
                    "Rate structures show typical market positioning",
                    "Multiple price ranges covered across carriers",
                    "Opportunities exist for detailed competitive analysis"
                ],
                "opportunities": [
                    "Detailed rate comparison across overlapping ranges",
                    "Identification of optimal pricing zones"
                ],
                "risks": [
                    "Market rates subject to frequent changes"
                ],
                "trend_commentary": "Current data provides baseline for ongoing competitive monitoring. Regular updates recommended for trend analysis."
            },
            "metadata": {
                "session_id": session_id,
                "generated_at": datetime.now().isoformat(),
                "note": "Fallback analysis - AI analysis unavailable"
            }
        }
    
    async def generate_quick_insights(self, session_id: Optional[int] = None) -> Dict:
        """
        Generate intelligent quick insights: competitive gaps, urgent actions, trends
        """
        if not self.token_manager:
            return {
                "competitive_gaps": "Competitive data available for detailed analysis",
                "urgent_actions": "No urgent changes detected at this time",
                "trend_summary": "Historical comparison requires multiple data points"
            }
        
        try:
            # Get current session
            if session_id is None:
                sessions = await db.execute_query(
                    "SELECT id FROM scrape_sessions ORDER BY timestamp DESC LIMIT 1"
                )
                if not sessions:
                    return {"error": "No sessions found"}
                session_id = sessions[0]['id']
            
            # Get current data with details
            current_data = await db.execute_query(
                "SELECT carrier, at_least_usd, but_less_than_usd, surcharge_pct FROM fuel_surcharges WHERE session_id = ? ORDER BY carrier, at_least_usd",
                (session_id,)
            )
            
            if not current_data:
                return {"error": "No data available"}
            
            # Get previous session for comparison
            prev_sessions = await db.execute_query(
                "SELECT id FROM scrape_sessions WHERE id < ? ORDER BY timestamp DESC LIMIT 1",
                (session_id,)
            )
            
            historical_context = ""
            if prev_sessions:
                prev_id = prev_sessions[0]['id']
                prev_data = await db.execute_query(
                    "SELECT carrier, AVG(surcharge_pct) as avg_pct, COUNT(*) as count FROM fuel_surcharges WHERE session_id = ? GROUP BY carrier",
                    (prev_id,)
                )
                if prev_data:
                    historical_context = "\n\nPrevious week data: " + ", ".join([
                        f"{row['carrier']}: {row['avg_pct']:.2f}% avg ({row['count']} rates)"
                        for row in prev_data
                    ])
            
            # Calculate current averages and competitive gaps
            carrier_stats = {}
            for row in current_data:
                carrier = row['carrier']
                if carrier not in carrier_stats:
                    carrier_stats[carrier] = {'rates': [], 'ranges': []}
                carrier_stats[carrier]['rates'].append(row['surcharge_pct'])
                carrier_stats[carrier]['ranges'].append(f"${row['at_least_usd']:.2f}-${row['but_less_than_usd']:.2f}")
            
            # Build analysis data
            analysis_data = {}
            for carrier, stats in carrier_stats.items():
                analysis_data[carrier] = {
                    'avg': round(sum(stats['rates']) / len(stats['rates']), 2),
                    'min': round(min(stats['rates']), 2),
                    'max': round(max(stats['rates']), 2),
                    'count': len(stats['rates'])
                }
            
            prompt = f"""You are a competitive pricing analyst for UPS. Analyze this fuel surcharge data and provide THREE specific, actionable insights.

Current Session Data:
{json.dumps(analysis_data, indent=2)}
{historical_context}

Return ONLY valid JSON with these keys:
{{
  "competitive_gaps": "Specific statement about where UPS is higher/lower than competitors with dollar ranges and percentages",
  "urgent_actions": "Most important competitive threat or opportunity requiring immediate attention (or 'No urgent changes' if stable)",
  "trend_summary": "Week-over-week changes summary with specific numbers (or 'First session - no historical comparison' if no previous data)"
}}

Examples:
- competitive_gaps: "UPS averages 20.5% vs FedEx 19.8% and DHL 15.2%. UPS is higher by 0.7-5.3% across most ranges."
- urgent_actions: "DHL increased rates by 2.5% in the $5-10 range, now matching UPS. Consider defensive pricing."
- trend_summary: "FedEx raised 8 rates this week (+0.5% avg). DHL lowered 3 rates (-0.3% avg). UPS unchanged."

Be specific, use actual numbers, mention carrier names. Format percentages as "20.5%" NOT "2e+01%". Start with {{:
{{"""
            
            response_text = await self._call_watsonx(prompt, max_tokens=400, temperature=0.3)
            parsed = parse_ai_json_response(response_text)
            
            if parsed:
                return parsed
            
            # Fallback with proper formatting
            ups_avg = analysis_data.get('UPS', {}).get('avg', 0)
            fedex_avg = analysis_data.get('FedEx', {}).get('avg', 0)
            dhl_avg = analysis_data.get('DHL', {}).get('avg', 0)
            
            return {
                "competitive_gaps": f"UPS averages {ups_avg:.2f}% vs FedEx {fedex_avg:.2f}% and DHL {dhl_avg:.2f}%. " + 
                                   (f"UPS is {abs(ups_avg - fedex_avg):.2f}% higher than FedEx." if ups_avg > fedex_avg else "UPS is competitive with FedEx."),
                "urgent_actions": "No significant changes detected. Continue monitoring competitor rates.",
                "trend_summary": "Current rates available for analysis. Historical comparison pending additional data points."
            }
            
        except Exception as e:
            print(f"⚠️ Quick insights generation error: {e}")
            return {
                "competitive_gaps": "Data analysis in progress",
                "urgent_actions": "Rates available for review",
                "trend_summary": "Historical comparison pending"
            }
    
    async def generate_rate_recommendations(self, session_id: Optional[int] = None) -> Dict:
        """
        Generate intelligent rate recommendations with competitive context
        """
        if not self.token_manager:
            return {
                "recommendations": [],
                "metadata": {"note": "AI unavailable"}
            }
        
        try:
            # Get current session
            if session_id is None:
                sessions = await db.execute_query(
                    "SELECT id FROM scrape_sessions ORDER BY timestamp DESC LIMIT 1"
                )
                if not sessions:
                    return {"error": "No sessions found"}
                session_id = sessions[0]['id']
            
            # Get current data
            current_data = await db.execute_query(
                "SELECT carrier, at_least_usd, but_less_than_usd, surcharge_pct FROM fuel_surcharges WHERE session_id = ? ORDER BY at_least_usd",
                (session_id,)
            )
            
            if not current_data:
                return {"error": "No data available"}
            
            # Get historical data (previous session)
            hist_sessions = await db.execute_query(
                "SELECT id FROM scrape_sessions WHERE id < ? ORDER BY timestamp DESC LIMIT 1",
                (session_id,)
            )
            
            historical_context = ""
            if hist_sessions:
                prev_id = hist_sessions[0]['id']
                prev_data = await db.execute_query(
                    "SELECT carrier, AVG(surcharge_pct) as avg_pct FROM fuel_surcharges WHERE session_id = ? GROUP BY carrier",
                    (prev_id,)
                )
                if prev_data:
                    historical_context = f"\n\nPrevious week averages: {json.dumps({row['carrier']: round(row['avg_pct'], 2) for row in prev_data})}"
            
            # Organize data by price range
            ranges_dict = {}
            for row in current_data:
                range_key = f"${row['at_least_usd']:.2f}-${row['but_less_than_usd']:.2f}"
                if range_key not in ranges_dict:
                    ranges_dict[range_key] = {
                        'min': row['at_least_usd'],
                        'max': row['but_less_than_usd'],
                        'carriers': {}
                    }
                ranges_dict[range_key]['carriers'][row['carrier']] = row['surcharge_pct']
            
            # Build prompt
            prompt = f"""You are a senior pricing strategist for UPS. Analyze this fuel surcharge data and provide 5-10 actionable rate recommendations.

Current Data (by price range):
{json.dumps(list(ranges_dict.values())[:20], indent=2)}
{historical_context}

Identify opportunities where UPS can:
1. Increase rates without losing competitiveness
2. Reduce rates to be more competitive in key segments
3. Add new offerings in gaps
4. Respond to recent competitor changes

Return ONLY valid JSON array (no markdown):
{{
  "recommendations": [
    {{
      "type": "rate_adjustment" | "new_offering" | "competitive_response" | "defensive_move",
      "price_range_min": 2.50,
      "price_range_max": 2.75,
      "current_rate": 20.00,
      "suggested_rate": 19.50,
      "competitors": {{"FedEx": 19.25, "DHL": 19.75}},
      "reasoning": "Specific explanation with numbers",
      "impact_analysis": {{
        "revenue_impact": "potential_increase" | "neutral" | "strategic_trade_off",
        "competitive_position": "maintains_edge" | "closes_gap" | "defensive",
        "historical_context": "What changed week over week"
      }}
    }}
  ]
}}

Prioritize high-impact recommendations. Be specific with numbers. Start with {{:
{{"""
            
            response_text = await self._call_watsonx(prompt, max_tokens=2000, temperature=0.4)
            parsed = parse_ai_json_response(response_text)
            
            if parsed and "recommendations" in parsed:
                return {
                    "recommendations": parsed["recommendations"],
                    "metadata": {
                        "session_id": session_id,
                        "generated_at": datetime.now().isoformat(),
                        "total_recommendations": len(parsed["recommendations"])
                    }
                }
            
            # Fallback - return empty
            return {
                "recommendations": [],
                "metadata": {
                    "session_id": session_id,
                    "generated_at": datetime.now().isoformat(),
                    "note": "Unable to generate recommendations"
                }
            }
            
        except Exception as e:
            print(f"⚠️ Rate recommendations generation error: {e}")
            return {
                "recommendations": [],
                "metadata": {"note": f"Error: {str(e)}"}
            }


# Global service instance
ai_service = AIService()
