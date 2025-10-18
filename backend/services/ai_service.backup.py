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
        
        async with httpx.AsyncClient(timeout=120.0) as client:
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
        Generate comprehensive executive-level analysis with FULL data context
        """
        if not self.token_manager:
            return self._generate_fallback_executive_analysis(session_id)
        
        try:
            # Get current session data - ALL ROWS WITH FULL DETAIL
            current_data = await db.execute_query(
                "SELECT carrier, service, at_least_usd, but_less_than_usd, surcharge_pct FROM fuel_surcharges WHERE session_id = ? ORDER BY carrier, at_least_usd",
                (session_id,)
            )
            
            if not current_data:
                return {"error": "No data available for analysis"}
            
            # Organize by carrier with FULL price range details
            carriers_full = {}
            for row in current_data:
                carrier = row['carrier']
                if carrier not in carriers_full:
                    carriers_full[carrier] = []
                carriers_full[carrier].append({
                    'range': f"${row['at_least_usd']:.2f}-${row['but_less_than_usd']:.2f}",
                    'pct': row['surcharge_pct'],
                    'service': row['service']
                })
            
            # Get historical session for week-over-week comparison
            prev_sessions = await db.execute_query(
                "SELECT id, timestamp FROM scrape_sessions WHERE id < ? ORDER BY timestamp DESC LIMIT 1",
                (session_id,)
            )
            
            historical_context = ""
            if prev_sessions:
                prev_id = prev_sessions[0]['id']
                prev_data = await db.execute_query(
                    "SELECT carrier, at_least_usd, but_less_than_usd, surcharge_pct FROM fuel_surcharges WHERE session_id = ? ORDER BY carrier, at_least_usd",
                    (prev_id,)
                )
                
                # Calculate detailed changes
                prev_by_carrier = {}
                for row in prev_data:
                    carrier = row['carrier']
                    if carrier not in prev_by_carrier:
                        prev_by_carrier[carrier] = []
                    prev_by_carrier[carrier].append({
                        'range': f"${row['at_least_usd']:.2f}-${row['but_less_than_usd']:.2f}",
                        'pct': row['surcharge_pct']
                    })
                
                # Find changes
                changes = []
                for carrier in carriers_full:
                    if carrier in prev_by_carrier:
                        curr_rates = [r['pct'] for r in carriers_full[carrier]]
                        prev_rates = [r['pct'] for r in prev_by_carrier[carrier]]
                        curr_avg = sum(curr_rates) / len(curr_rates) if curr_rates else 0
                        prev_avg = sum(prev_rates) / len(prev_rates) if prev_rates else 0
                        change = curr_avg - prev_avg
                        if abs(change) > 0.01:
                            changes.append(f"{carrier}: {change:+.2f}% (from {prev_avg:.2f}% to {curr_avg:.2f}%)")
                
                if changes:
                    historical_context = f"\n\nWEEK-OVER-WEEK CHANGES:\n" + "\n".join(changes)
            
            # Build RICH CONTEXT - This is the key fix!
            data_context = "COMPLETE FUEL SURCHARGE DATA:\n\n"
            for carrier in ['UPS', 'FedEx', 'DHL']:
                if carrier in carriers_full:
                    data_context += f"\n{carrier} ({len(carriers_full[carrier])} price ranges):\n"
                    for item in carriers_full[carrier][:30]:  # Show up to 30 ranges
                        data_context += f"  {item['range']}: {item['pct']}% ({item['service']})\n"
            
            # Calculate gaps and overlaps
            ups_ranges = set(r['range'] for r in carriers_full.get('UPS', []))
            fedex_ranges = set(r['range'] for r in carriers_full.get('FedEx', []))
            dhl_ranges = set(r['range'] for r in carriers_full.get('DHL', []))
            
            overlap_all = ups_ranges & fedex_ranges & dhl_ranges
            overlap_ups_fedex = ups_ranges & fedex_ranges - dhl_ranges
            overlap_ups_dhl = ups_ranges & dhl_ranges - fedex_ranges
            
            gap_analysis = f"\n\nGAP ANALYSIS:\n"
            gap_analysis += f"- All 3 carriers overlap: {len(overlap_all)} ranges\n"
            gap_analysis += f"- UPS & FedEx only: {len(overlap_ups_fedex)} ranges\n"
            gap_analysis += f"- UPS & DHL only: {len(overlap_ups_dhl)} ranges\n"
            gap_analysis += f"- UPS unique ranges: {len(ups_ranges - fedex_ranges - dhl_ranges)}\n"
            
            # Construct powerful prompt with ALL context
            prompt = f"""You are a senior executive pricing strategist for UPS analyzing competitive fuel surcharge intelligence.

{data_context}
{gap_analysis}
{historical_context}

YOUR TASK: Generate executive-level analysis in JSON format with SPECIFIC, DATA-DRIVEN insights.

Return ONLY valid JSON:
{{
  "summary": "2-3 sentence executive summary citing ACTUAL price ranges and percentages",
  "key_findings": [
    "Finding with SPECIFIC data: e.g., 'UPS starts at $1.93 (18.5%) vs DHL at $1.18 (10%) - 63% higher entry point creates volume risk'",
    "Another specific finding with numbers and ranges",
    "Another finding referencing actual competitor gaps",
    "One more finding with actionable implications"
  ],
  "opportunities": [
    "SPECIFIC opportunity: e.g., 'DHL covers $1.18-$3.73 range. UPS could add sub-$1.93 tier at 16% to capture low-value shipments'",
    "Another opportunity with exact ranges and percentages",
    "Third opportunity based on competitive positioning"
  ],
  "risks": [
    "SPECIFIC risk: e.g., 'DHL charges 10-15% for $1.18-$2.50 range vs our 18.5-19.5% - risk of 15-20% volume loss in this segment'",
    "Another risk with numbers and market implications"
  ],
  "trend_commentary": "Analysis of week-over-week changes with SPECIFIC carriers, ranges, and percentage movements. If no changes, analyze current competitive positioning."
}}

CRITICAL RULES:
- Reference ACTUAL price ranges (e.g., $1.93-$2.20, $3.01-$4.00)
- Cite ACTUAL percentages from the data
- Be specific about which carrier does what
- NO generic statements like "market is competitive" - use NUMBERS
- Each insight should have: carrier name + price range + percentage + implication
- Make recommendations actionable (not just "monitor trends")

Start with {{:
{{"""
            
            response_text = await self._call_watsonx(prompt, max_tokens=2000, temperature=0.4)
            parsed = parse_ai_json_response(response_text)
            
            if parsed:
                return {
                    "analysis": parsed,
                    "metadata": {
                        "session_id": session_id,
                        "carriers_analyzed": list(carriers_full.keys()),
                        "total_ranges": sum(len(carriers_full[c]) for c in carriers_full),
                        "generated_at": datetime.now().isoformat()
                    }
                }
            
            print(f"⚠️ Executive analysis JSON parsing failed")
            return self._generate_fallback_executive_analysis(session_id)
            
        except Exception as e:
            print(f"⚠️ Executive analysis generation error: {e}")
            import traceback
            traceback.print_exc()
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
        Generate intelligent quick insights with DETAILED week-over-week comparison
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
            
            # Get FULL current data with all ranges
            current_data = await db.execute_query(
                "SELECT carrier, at_least_usd, but_less_than_usd, surcharge_pct FROM fuel_surcharges WHERE session_id = ? ORDER BY carrier, at_least_usd",
                (session_id,)
            )
            
            if not current_data:
                return {"error": "No data available"}
            
            # Organize current data
            current_by_carrier = {}
            for row in current_data:
                carrier = row['carrier']
                if carrier not in current_by_carrier:
                    current_by_carrier[carrier] = []
                current_by_carrier[carrier].append({
                    'range': f"${row['at_least_usd']:.2f}-${row['but_less_than_usd']:.2f}",
                    'pct': row['surcharge_pct']
                })
            
            # Get previous session for DETAILED comparison
            prev_sessions = await db.execute_query(
                "SELECT id FROM scrape_sessions WHERE id < ? ORDER BY timestamp DESC LIMIT 1",
                (session_id,)
            )
            
            # Calculate detailed changes
            detailed_changes = []
            historical_context = ""
            
            if prev_sessions:
                prev_id = prev_sessions[0]['id']
                prev_data = await db.execute_query(
                    "SELECT carrier, at_least_usd, but_less_than_usd, surcharge_pct FROM fuel_surcharges WHERE session_id = ? ORDER BY carrier, at_least_usd",
                    (prev_id,)
                )
                
                # Organize prev data
                prev_by_carrier = {}
                for row in prev_data:
                    carrier = row['carrier']
                    if carrier not in prev_by_carrier:
                        prev_by_carrier[carrier] = []
                    prev_by_carrier[carrier].append({
                        'range': f"${row['at_least_usd']:.2f}-${row['but_less_than_usd']:.2f}",
                        'pct': row['surcharge_pct']
                    })
                
                # Find actual changes row by row
                for carrier in current_by_carrier:
                    if carrier in prev_by_carrier:
                        curr_list = current_by_carrier[carrier]
                        prev_list = prev_by_carrier[carrier]
                        
                        # Match by range and find differences
                        for i, curr_item in enumerate(curr_list):
                            if i < len(prev_list):
                                prev_item = prev_list[i]
                                if curr_item['range'] == prev_item['range']:
                                    diff = curr_item['pct'] - prev_item['pct']
                                    if abs(diff) >= 0.1:  # 0.1% threshold
                                        detailed_changes.append({
                                            'carrier': carrier,
                                            'range': curr_item['range'],
                                            'from': prev_item['pct'],
                                            'to': curr_item['pct'],
                                            'change': diff
                                        })
                
                if detailed_changes:
                    changes_text = []
                    for ch in detailed_changes[:10]:  # Top 10 changes
                        changes_text.append(f"{ch['carrier']} {ch['range']}: {ch['from']:.2f}% → {ch['to']:.2f}% ({ch['change']:+.2f}%)")
                    historical_context = "\n\nDETAILED WEEK-OVER-WEEK CHANGES:\n" + "\n".join(changes_text)
            
            # Calculate competitive gaps
            carrier_summaries = {}
            for carrier, items in current_by_carrier.items():
                rates = [i['pct'] for i in items]
                carrier_summaries[carrier] = {
                    'avg': round(sum(rates) / len(rates), 2),
                    'min': round(min(rates), 2),
                    'max': round(max(rates), 2),
                    'count': len(rates),
                    'ranges': [i['range'] for i in items[:5]]  # First 5 ranges
                }
            
            prompt = f"""You are a competitive pricing analyst for UPS. Analyze this detailed fuel surcharge data.

CURRENT DATA SUMMARY:
{json.dumps(carrier_summaries, indent=2)}
{historical_context}

Return ONLY valid JSON:
{{
  "competitive_gaps": "Detailed statement showing SPECIFIC ranges where UPS is higher/lower. e.g., 'UPS $1.93-$2.20 at 18.5% vs DHL $1.93-$2.20 at 16.25% - UPS is 2.25% higher in this segment'",
  "urgent_actions": "Most critical change requiring action (cite SPECIFIC ranges and percentages) or 'No significant changes detected' if changes < 0.5%",
  "trend_summary": "Summary of week-over-week changes with SPECIFIC carriers and percentage movements, or 'No previous session for comparison' if first time"
}}

CRITICAL:
- Use ACTUAL price ranges and percentages from the data
- Format percentages as "20.50%" NOT "2e+01%"
- Be specific: mention carrier names, dollar ranges, exact percentages
- If changes detected, MUST cite them specifically
- If no changes > 0.1%, say so explicitly

Start with {{:
{{"""
            
            response_text = await self._call_watsonx(prompt, max_tokens=500, temperature=0.3)
            parsed = parse_ai_json_response(response_text)
            
            if parsed:
                return parsed
            
            # Enhanced fallback
            ups_avg = carrier_summaries.get('UPS', {}).get('avg', 0)
            fedex_avg = carrier_summaries.get('FedEx', {}).get('avg', 0)
            dhl_avg = carrier_summaries.get('DHL', {}).get('avg', 0)
            
            gaps_text = f"UPS averages {ups_avg:.2f}% vs FedEx {fedex_avg:.2f}% and DHL {dhl_avg:.2f}%. "
            if ups_avg > fedex_avg:
                gaps_text += f"UPS is {(ups_avg - fedex_avg):.2f}% higher than FedEx. "
            if ups_avg > dhl_avg:
                gaps_text += f"UPS is {(ups_avg - dhl_avg):.2f}% higher than DHL."
            
            trend_text = "Current rates available for analysis."
            if detailed_changes:
                change_count = len(detailed_changes)
                avg_change = sum(abs(c['change']) for c in detailed_changes) / len(detailed_changes)
                trend_text = f"Detected {change_count} rate changes averaging {avg_change:.2f}% difference week-over-week."
            
            return {
                "competitive_gaps": gaps_text,
                "urgent_actions": "Continue monitoring competitor rates" if not detailed_changes else f"{len(detailed_changes)} rates changed this week - review for strategic response",
                "trend_summary": trend_text
            }
            
        except Exception as e:
            print(f"⚠️ Quick insights generation error: {e}")
            import traceback
            traceback.print_exc()
            return {
                "competitive_gaps": "Data analysis in progress",
                "urgent_actions": "Rates available for review",
                "trend_summary": "Historical comparison pending"
            }
    
    async def generate_rate_recommendations(self, session_id: Optional[int] = None) -> Dict:
        """
        Generate rate recommendations ONLY for UPS's actual ranges with full competitive context
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
            
            # Get ALL current data organized by carrier
            current_data = await db.execute_query(
                "SELECT carrier, at_least_usd, but_less_than_usd, surcharge_pct FROM fuel_surcharges WHERE session_id = ? ORDER BY carrier, at_least_usd",
                (session_id,)
            )
            
            if not current_data:
                return {"error": "No data available"}
            
            # Organize by carrier
            by_carrier = {}
            for row in current_data:
                carrier = row['carrier']
                if carrier not in by_carrier:
                    by_carrier[carrier] = []
                by_carrier[carrier].append({
                    'min': row['at_least_usd'],
                    'max': row['but_less_than_usd'],
                    'pct': row['surcharge_pct']
                })
            
            # Get UPS ranges specifically
            ups_ranges = by_carrier.get('UPS', [])
            if not ups_ranges:
                return {"error": "No UPS data available"}
            
            # For each UPS range, find competitor rates in same/overlapping ranges
            ups_with_competitors = []
            for ups_item in ups_ranges:
                ups_min, ups_max, ups_pct = ups_item['min'], ups_item['max'], ups_item['pct']
                range_str = f"${ups_min:.2f}-${ups_max:.2f}"
                
                competitors_in_range = {}
                
                # Check FedEx
                for fed_item in by_carrier.get('FedEx', []):
                    # Check for overlap
                    if (fed_item['min'] <= ups_max and fed_item['max'] >= ups_min):
                        if 'FedEx' not in competitors_in_range:
                            competitors_in_range['FedEx'] = []
                        competitors_in_range['FedEx'].append(fed_item['pct'])
                
                # Check DHL
                for dhl_item in by_carrier.get('DHL', []):
                    if (dhl_item['min'] <= ups_max and dhl_item['max'] >= ups_min):
                        if 'DHL' not in competitors_in_range:
                            competitors_in_range['DHL'] = []
                        competitors_in_range['DHL'].append(dhl_item['pct'])
                
                # Average competitors in this range
                competitor_summary = {}
                for comp, pcts in competitors_in_range.items():
                    competitor_summary[comp] = round(sum(pcts) / len(pcts), 2) if pcts else None
                
                ups_with_competitors.append({
                    'range': range_str,
                    'min': ups_min,
                    'max': ups_max,
                    'current_pct': ups_pct,
                    'competitors': competitor_summary
                })
            
            # Get historical context
            hist_sessions = await db.execute_query(
                "SELECT id FROM scrape_sessions WHERE id < ? ORDER BY timestamp DESC LIMIT 1",
                (session_id,)
            )
            
            historical_context = ""
            if hist_sessions:
                prev_id = hist_sessions[0]['id']
                prev_data = await db.execute_query(
                    "SELECT carrier, at_least_usd, but_less_than_usd, surcharge_pct FROM fuel_surcharges WHERE session_id = ? AND carrier = 'UPS' ORDER BY at_least_usd",
                    (prev_id,)
                )
                
                if prev_data:
                    changes = []
                    for i, prev_row in enumerate(prev_data):
                        if i < len(ups_ranges):
                            curr_pct = ups_ranges[i]['pct']
                            prev_pct = prev_row['surcharge_pct']
                            diff = curr_pct - prev_pct
                            if abs(diff) >= 0.1:
                                changes.append(f"${prev_row['at_least_usd']:.2f}-${prev_row['but_less_than_usd']:.2f}: {prev_pct:.2f}% → {curr_pct:.2f}% ({diff:+.2f}%)")
                    
                    if changes:
                        historical_context = "\n\nUPS WEEK-OVER-WEEK CHANGES:\n" + "\n".join(changes)
            
            # Build comprehensive prompt
            prompt = f"""You are a senior pricing strategist for UPS. Generate 5-7 SPECIFIC rate recommendations based on this COMPLETE data.

UPS CURRENT RATES (ALL {len(ups_with_competitors)} RANGES):
{json.dumps(ups_with_competitors, indent=2)}
{historical_context}

CRITICAL CONSTRAINTS:
- ONLY recommend adjustments to UPS's EXISTING price ranges shown above
- EXCEPTION: You MAY suggest new price range offerings if there's a competitive gap
- EVERY recommendation MUST reference actual UPS ranges from the data above
- DO NOT suggest ranges like $1.45-$1.48 if UPS doesn't offer that range!

Return ONLY valid JSON:
{{
  "recommendations": [
    {{
      "type": "rate_adjustment" | "new_offering" | "competitive_response" | "defensive_move",
      "price_range_min": 1.93,
      "price_range_max": 2.20,
      "current_rate": 18.50,
      "suggested_rate": 18.00,
      "competitors": {{"FedEx": null, "DHL": 16.25}},
      "reasoning": "DETAILED explanation: DHL charges 16.25% in this range vs our 18.50%. Reducing to 18.00% closes the 2.25% gap while maintaining revenue. Expected 3-5% volume increase in this segment worth $50K monthly.",
      "impact_analysis": {{
        "revenue_impact": "Detailed revenue calculation or trade-off explanation (50+ words)",
        "competitive_position": "Detailed positioning analysis with specific numbers (30+ words)",
        "historical_context": "What changed and why it matters (30+ words)"
      }}
    }}
  ]
}}

QUALITY STANDARDS:
- reasoning: 50+ words with specific calculations
- revenue_impact: NOT "strategic_trade_off" - actual detailed explanation
- competitive_position: NOT "closes_gap" - explain HOW and by HOW MUCH
- historical_context: NOT generic - cite actual changes if any

Generate 5-7 HIGH-IMPACT recommendations. Start with {{:
{{"""
            
            response_text = await self._call_watsonx(prompt, max_tokens=2500, temperature=0.4)
            parsed = parse_ai_json_response(response_text)
            
            if parsed and "recommendations" in parsed:
                # Validate recommendations only reference UPS ranges
                valid_recommendations = []
                ups_range_set = set((r['min'], r['max']) for r in ups_ranges)
                
                for rec in parsed["recommendations"]:
                    rec_min = rec.get('price_range_min', 0)
                    rec_max = rec.get('price_range_max', 0)
                    
                    # Allow if it's UPS's actual range OR if it's a new offering
                    is_existing_range = any(abs(rec_min - ups_min) < 0.01 and abs(rec_max - ups_max) < 0.01 for ups_min, ups_max in ups_range_set)
                    is_new_offering = rec.get('type') == 'new_offering'
                    
                    if is_existing_range or is_new_offering:
                        valid_recommendations.append(rec)
                    else:
                        print(f"⚠️ Filtered invalid recommendation for range ${rec_min}-${rec_max} (not in UPS data)")
                
                return {
                    "recommendations": valid_recommendations,
                    "metadata": {
                        "session_id": session_id,
                        "generated_at": datetime.now().isoformat(),
                        "total_recommendations": len(valid_recommendations),
                        "ups_ranges_analyzed": len(ups_ranges)
                    }
                }
            
            print(f"⚠️ Rate recommendations JSON parsing failed")
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
            import traceback
            traceback.print_exc()
            return {
                "recommendations": [],
                "metadata": {"note": f"Error: {str(e)}"}
            }


# Global service instance
ai_service = AIService()
