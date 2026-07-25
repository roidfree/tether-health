# Tether Health

24-hour Juno hackathon: https://luma.com/londonai-m2w1?tk=tQ9ZvK
Notion: https://app.notion.com/p/Builder-Guide-Build-the-Future-of-Healthcare-3a74f0c6b758817997bdd0f9b08c3a64

Consumer-focused mobile application utilising AI voice agents for medication reminders and also calling functionality. Adherence should be encouraging moreso than policing.

## Requirements
High priority:
- Authentication per user
- Onboarding for personal information like name, age etc
- Input during onboarding for medication type and frequency
- Voice agent functionality, simulating an actual person
- Each call should have context of which medication, which frequency, and current time when conversing with agent
- Options for call, like call back in 5 minutes
- Shows past history of medication taken on regular dashboard, also which medications are currently being taken and how often, what time etc.
- Add new medications and frequencies manually at any time

Secondary priority:
- Voice agent onboarded to simulate an accountability partner, such as a parent, child, friend etc.
- Multi-language

## Tech stack
- Using macOS plugged into iPhone
- Python FastAPI + supabase for backend, database, auth, and API integrations
- Anthropic Claude for coming up with script for agent
- Use Expo Dev Build natively mac for relevant libraries to make it work with @livekit/react-native @livekit/react-native-webrtc livekit-cli
- Use elevenlabs for voices
- connect through python livekit-agents with anthropic, elevenlabs, silero, turn-detector

