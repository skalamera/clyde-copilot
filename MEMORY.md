# Long-Term Memory

## Key Design Decisions & Architectural Patterns
- **Context-Sensitive UI Complexity**: When Clyde Managed Cloud (`llmProvider === 'clyde-cloud'`) is selected, Pinecone configuration inputs (API Key, Host URL, Namespace) are hidden from the onboarding wizard (`ProSetupStep`) and the settings panel (`SettingsDrawer`). These settings are moved inside the custom LLM provider options.
- **System Prompt Calendar Parsing**: To prevent displaying stale/past meetings under "upcoming interviews" in the agent system prompt, always split calendar events into past and future based on `Date.now()`. Slice a limited set of recent past events (e.g., last 5) and future upcoming events (e.g., next 10).
- **Pro Realtime Voice Agent Labeling**: Keep model-specific implementation names (e.g., `gpt-realtime-2`) hidden from users in all UI views and preflight settings summaries. Use user-friendly terms like "Clyde Pro agent".

## Lessons Learned & Gotchas
- **LLM Client Timeouts**: Hardcoded connection/request timeouts for LLM providers (OpenAI, Anthropic, Clyde Cloud, and mock interview helpers) must be long enough (e.g., `300000ms` or 5 minutes) to accommodate heavy local models or complex JSON structuring tasks that can take more than 2 minutes to generate responses.
- **Robust Vector Search Queries**: Always wrap vector search queries (like Pinecone) in try-catch blocks to catch dimension mismatch or API key errors gracefully, preventing the entire conversational flow from crashing.
