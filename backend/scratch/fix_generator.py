import re

path = r"c:\Users\achyu\Desktop\Qontint Backup\backend\services\content_generator.py"

with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# I will find the block starting with "    fallback_dict = {" and ending right before "    try:\n        model = get_gemini_model()"
# Wait, actually I can just reconstruct the generate_competitor_comparison function correctly from scratch for the bottom half.

# The function signature is:
# async def generate_competitor_comparison(
#     content: str, keyword: str, vertical: str, serp_docs: list[Any]
# ) -> dict | None:

# Let's find def generate_competitor_comparison
match = re.search(r"async def generate_competitor_comparison.*?if not top_3:\n        return None\n", content, re.DOTALL)
if match:
    top_half = match.group(0)
    
    bottom_half = """
    fallback_dict = {
        "overview": {
            "market_summary": f"Initial SERP analysis for {keyword} in {vertical}.",
            "competitiveness": "Unknown"
        },
        "top_competitors": top_competitors,
        "summary_table": {
            "comparison_points": ["Content Depth", "Authority", "Focus"],
            "competitor_scores": []
        },
        "recommendations": {}
    }

    try:
        model = get_gemini_model()
        
        prompt = f'''
        Analyze these top competitors for the keyword "{keyword}" in the "{vertical}" vertical.
        
        Competitors Data:
        {json.dumps(top_competitors, indent=2)}
        
        User Content:
        {content[:3000]}
        
        Return JSON matching this exact structure:
        {{
            "overview": {{"market_summary": "string", "competitiveness": "High|Medium|Low"}},
            "summary_table": {{"comparison_points": ["string", "string", "string"], "competitor_scores": [{{"competitor_name": "string", "scores": [8, 7, 9]}}]}},
            "recommendations": {{"competitor_1": ["string"], "competitor_2": ["string"], "competitor_3": ["string"]}}
        }}
        '''
        
        resp = await model.generate_content_async(prompt, timeout=settings.GEMINI_TIMEOUT)
        
        text = resp.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
        
        parsed_json = json.loads(text)
        
        result = {
            "overview": parsed_json.get("overview", {}),
            "top_competitors": top_competitors,
            "summary_table": parsed_json.get("summary_table", {}),
            "recommendations": parsed_json.get("recommendations", {}),
        }
        return result

    except Exception as exc:
        logger.error("Error generating competitor comparison: %s", exc)
        return fallback_dict
"""
    
    with open(path, "w", encoding="utf-8") as f:
        # replace everything after `if not top_3:\n        return None\n` up to the end of the file with the new bottom_half
        # wait, the function is the LAST function in the file, but there might be other things.
        # Actually I can just replace the whole text from `if not top_3:\n        return None\n` to the end of the file.
        new_content = content[:match.end()] + bottom_half
        f.write(new_content)
    print("Fixed!")
else:
    print("Could not match top half.")

