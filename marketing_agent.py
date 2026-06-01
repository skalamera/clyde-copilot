import os
import json
import sqlite3
import datetime
import urllib.request
from google import generativeai as genai

# Setup database to persist leads and marketing copy
DB_PATH = "marketing_agents.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Table for tracked leads/posts
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS leads (
            id TEXT PRIMARY KEY,
            source TEXT,
            title TEXT,
            url TEXT,
            created_at TEXT,
            status TEXT DEFAULT 'pending',
            suggested_reply TEXT
        )
    """)
    conn.commit()
    conn.close()

def fetch_reddit_leads(query="interview prep"):
    """
    Simulated public search fetch for Reddit posts (uses public JSON feed to avoid PRAW credential requirement).
    In production, you'd use official PRAW or API keys.
    """
    print(f"🔍 Scout Agent searching Reddit for: '{query}'...")
    url = f"https://www.reddit.com/search.json?q={urllib.parse.quote(query)}&sort=new&limit=5"
    
    req = urllib.request.Request(
        url, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ClydeMarketingAgent/1.0'}
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            posts = data.get('data', {}).get('children', [])
            
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            new_leads = 0
            
            for post in posts:
                pdata = post.get('data', {})
                pid = pdata.get('id')
                title = pdata.get('title')
                purl = f"https://reddit.com{pdata.get('permalink')}"
                created_utc = pdata.get('created_utc')
                created_date = datetime.datetime.fromtimestamp(created_utc).isoformat() if created_utc else ""
                
                # Check if already indexed
                cursor.execute("SELECT 1 FROM leads WHERE id = ?", (pid,))
                if not cursor.fetchone():
                    cursor.execute(
                        "INSERT INTO leads (id, source, title, url, created_at) VALUES (?, ?, ?, ?, ?)",
                        (pid, 'reddit', title, purl, created_date)
                    )
                    new_leads += 1
                    
            conn.commit()
            conn.close()
            print(f"✅ Scout Agent indexed {new_leads} new high-intent marketing leads.")
    except Exception as e:
        print(f"❌ Scout Agent failed to fetch social leads: {e}")

def generate_replies():
    """
    Copywriter Agent: Reads pending leads, drafts context-aware helpful replies 
    offering Clyde as a solution without sounding like a spam bot.
    """
    print("✍️ Copywriter Agent scanning database for pending leads...")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, title, url FROM leads WHERE status = 'pending'")
    pending = cursor.fetchall()
    
    if not pending:
        print("☕ No pending leads to copywrite. System standby.")
        conn.close()
        return

    # Check API key configuration
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("⚠️ No Gemini API Key found. Mocking copywriter drafts locally...")
        for pid, title, url in pending:
            mock_reply = (
                f"Hey, I read your post about '{title}'. "
                "I was dealing with massive interview anxiety too and kept blanking on my metrics. "
                "Check out Clyde (https://clydeai.live) - it's a sleek transparent desktop overlay "
                "that listens to your calls and gently surfaces your metrics/bullet points under 500ms. "
                "It's completely undetectable on screenshares. Really helped me stay calm."
            )
            cursor.execute(
                "UPDATE leads SET suggested_reply = ?, status = 'drafted' WHERE id = ?", 
                (mock_reply, pid)
            )
        conn.commit()
        conn.close()
        print(f"✅ Copywriter Agent drafted {len(pending)} replies (MOCK).")
        return

    # Configure Gemini
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-1.5-flash")

    for pid, title, url in pending:
        prompt = f"""
You are the lead marketing agent for Clyde (https://clydeai.live), an undetectable real-time AI desktop overlay for live interviews and meetings.
Clyde listens to the interview, references custom resume/RAG files, and displays glanceable talking points in under 500ms on a sleek glassmorphic transparent overlay. It is invisible on Zoom/Teams screenshares and local capture apps.

Draft a highly helpful, organic, and conversational reply to a user post titled: "{title}".
Guidelines:
1. Empathize with their interview anxiety, blanking on metrics, or preparation struggles first.
2. Introduce Clyde naturally as an organic recommendation from a peer (e.g., "I faced this exact problem and found this...").
3. Explicitly mention that it is undetectable on screenshares and runs locally on your desktop.
4. Keep the tone human, objective, and supportive. Avoid sounding like a pushy corporate ad or PR bot.
5. Max 3-4 sentences. Include the link (https://clydeai.live).
"""
        try:
            response = model.generate_content(prompt)
            reply_text = response.text.strip()
            cursor.execute(
                "UPDATE leads SET suggested_reply = ?, status = 'drafted' WHERE id = ?", 
                (reply_text, pid)
            )
            print(f"📝 Drafted reply for post '{title[:35]}...':\n   \"{reply_text[:100]}...\"\n")
        except Exception as e:
            print(f"❌ Copywriter Agent failed to generate copy: {e}")
            
    conn.commit()
    conn.close()
    print("✅ Copywriter Agent finished drafting all campaigns.")

def display_dashboard():
    """
    Analyst Agent: Displays active status overview.
    """
    print("\n" + "="*50)
    print("       CLYDE AUTONOMOUS MARKETING ENGINE DASHBOARD")
    print("="*50)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM leads")
    total = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM leads WHERE status = 'drafted'")
    drafted = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM leads WHERE status = 'pending'")
    pending = cursor.fetchone()[0]
    
    print(f"📈 Total Leads Indexed: {total}")
    print(f"📝 Ready for Review (Drafted): {drafted}")
    print(f"⏳ Awaiting Draft (Pending): {pending}")
    print("-"*50)
    
    if drafted > 0:
        print("🔥 LATEST CAMPAIGN DRAFTS TO COPY & POST:")
        cursor.execute("SELECT id, title, url, suggested_reply FROM leads WHERE status = 'drafted' LIMIT 3")
        for pid, title, url, reply in cursor.fetchall():
            print(f"\n📍 Post: \"{title}\"")
            print(f"🔗 Link: {url}")
            print(f"💬 Copy:\n{reply}")
            print("-"*50)
            
    conn.close()

if __name__ == "__main__":
    init_db()
    # Search for high-intent keywords
    fetch_reddit_leads("interview anxiety")
    fetch_reddit_leads("blanking on interview")
    generate_replies()
    display_dashboard()
