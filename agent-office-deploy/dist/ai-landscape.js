(function () {
  // Every entry is assigned to ONE category group. Cards are collapsible, the
  // category groups are collapsible, and the cost graph lives at the very bottom.
  const ais = [
    // ---------------------------------------------------------------- Chatbots
    {
      name: "ChatGPT",
      company: "OpenAI",
      group: "Chatbots",
      kind: "OpenAI model family",
      bestFor: "Reasoning, coding, multimodal work, agents, writing, and daily productivity",
      strengths: ["Reasoning", "Coding", "Multimodal", "Agents"],
      api: "Public API",
      apiNote: "Full developer API across the GPT, realtime, and image model lines.",
      limits: "Cost scales sharply with reasoning effort; rate limits on lower tiers.",
      generalUseCases: ["Deep reasoning and complex problem solving", "Coding, debugging, and repo planning", "Writing, editing, summarization, and research", "Agentic task execution and multimodal workflows"],
      submodels: [
        model("GPT-5.5", "Latest flagship", "Newest top OpenAI model tier for stronger reasoning, coding, planning, and professional-grade assistant workflows.", "Best for hard reasoning, advanced coding, research, and high-value tasks", "High", "Heavy"),
        model("GPT-5.4", "Flagship", "High-capability GPT-5 family model for complex reasoning, analysis, and multimodal work.", "Best for premium assistant experiences and difficult prompts", "High", "Heavy"),
        model("GPT-5.3 Instant", "Fast", "Fast-response GPT tier built for speed-sensitive everyday assistant use.", "Best for chat, quick answers, lightweight product features, and daily productivity", "Medium", "Moderate"),
        model("GPT-5.3-Codex", "Coding", "Coding-focused GPT model tier for repo work, debugging, implementation, and software tasks.", "Best for IDE copilots, code reviews, test fixes, and full-stack builds", "Medium", "Moderate to heavy"),
        model("GPT-realtime-1.5", "Voice", "Realtime multimodal model optimized for low-latency voice and live conversational agents.", "Best for voice agents, call flows, and live assistant apps", "High", "Very heavy"),
        model("GPT-image-1.5", "Image", "Image model for generating, editing, and transforming visual content from text or visual prompts.", "Best for thumbnails, mockups, ads, design concepts, and visual content", "High", "Heavy")
      ]
    },
    {
      name: "Claude",
      company: "Anthropic",
      group: "Chatbots",
      kind: "Anthropic model family",
      bestFor: "Long-form writing, careful analysis, codebases, agents, and thoughtful reasoning",
      strengths: ["Writing", "Coding", "Reasoning", "Long context"],
      api: "Public API",
      apiNote: "Developer API across the Opus, Sonnet, and Haiku tiers, plus the Agent SDK.",
      limits: "Flagship Opus tier is expensive; tighter free-tier message caps.",
      generalUseCases: ["Long-form writing and editing", "Codebase reasoning and agentic coding", "Business planning and analysis", "Document summarization and careful explanations"],
      submodels: [
        model("Claude Opus 4.8", "Latest flagship", "Top Claude model tier for hard reasoning, coding, long-running agents, and premium-quality outputs.", "Best for hardest coding jobs, strategic analysis, and deep writing", "High", "Heavy"),
        model("Claude Sonnet 4.6", "Balanced", "Updated Sonnet-family model focused on coding, agents, speed, and high-quality everyday work.", "Best for most day-to-day coding, writing, analysis, and assistant workflows", "Medium", "Moderate"),
        model("Claude Haiku 4.5", "Fast", "Lightweight Claude model tuned for speed, throughput, and lower-cost assistant flows.", "Best for summaries, support bots, routing, and quick responses", "Low", "Light"),
        model("Fable 5", "Creative", "Newer Claude-family model line geared toward creative, expressive, and conversational output.", "Best for creative writing, character, and expressive assistant experiences", "Medium", "Moderate")
      ]
    },
    {
      name: "Gemini",
      company: "Google",
      group: "Chatbots",
      kind: "Google model family",
      bestFor: "Google apps, coding, agents, multimodal work, and search-linked productivity",
      strengths: ["Google stack", "Agents", "Multimodal", "Coding"],
      api: "Public API",
      apiNote: "Available via Google AI Studio and Vertex AI across the Gemini line.",
      limits: "Best value is inside the Google ecosystem; quotas vary by tier.",
      generalUseCases: ["Drafting in Gmail, Docs, Sheets, and Slides", "Search-connected answers and productivity", "Agentic workflows through the Google ecosystem", "Video, audio, image, and multimodal creation"],
      submodels: [
        model("Gemini 3.5 Flash", "Latest fast agentic", "Newer Gemini model promoted for faster agentic behavior, coding, and responsive everyday AI use.", "Best for fast assistants, agents, coding, and Google app productivity", "Low", "Light to moderate"),
        model("Gemini 3.5 Pro", "Pro", "Higher-end Gemini 3.5 tier for stronger reasoning, coding, and power-user workflows.", "Best for advanced reasoning, research, and complex developer workflows", "Medium", "Moderate"),
        model("Gemini 3", "Core frontier", "Gemini 3 family emphasizes stronger reasoning, multimodal capability, and broad Google product integration.", "Best for rich multimodal tasks, assistant workflows, and Google ecosystem work", "Medium", "Moderate"),
        model("Gemini Omni Flash", "Create anything", "Generative media family designed to create video/audio outputs from text, images, video, or audio inputs.", "Best for video generation, audio/video remixes, and creative media workflows", "High", "Heavy")
      ]
    },
    {
      name: "Grok",
      company: "xAI",
      group: "Chatbots",
      kind: "xAI model family",
      bestFor: "Real-time web/X search, coding, reasoning, voice, images, and video generation",
      strengths: ["Real-time", "Social", "Coding", "Media"],
      api: "Public API",
      apiNote: "xAI API for the main model plus image/video and voice endpoints.",
      limits: "Best context is tied to X; media APIs are pricey.",
      generalUseCases: ["Live web and X-aware context", "Coding and technical help", "Real-time search and trend interpretation", "Image, video, and voice generation"],
      submodels: [
        model("Grok 4.3", "Latest main model", "xAI current main model for chat, coding, reasoning, tool use, vision, and real-time search workflows.", "Best for real-time reasoning, coding, and X/web-aware assistance", "Medium", "Moderate"),
        model("Grok Imagine API", "Image / video", "Dedicated xAI media API for image and short video generation workflows.", "Best for visuals, short videos, social media assets, and creative generation", "High", "Heavy"),
        model("Grok Voice API", "Voice", "Voice-focused xAI model/API layer for speech-first assistant experiences.", "Best for voice agents, live chat, and conversational interfaces", "High", "Very heavy")
      ]
    },
    {
      name: "Microsoft 365 Copilot",
      company: "Microsoft",
      group: "Chatbots",
      kind: "Enterprise assistant",
      bestFor: "Work documents, enterprise knowledge, meetings, secure workflows, and internal agents",
      strengths: ["Enterprise", "Office", "Meetings", "Work data"],
      api: "Enterprise only",
      apiNote: "No public model API; extend via Copilot Studio and Microsoft Graph inside a tenant.",
      limits: "Requires enterprise licensing; pricing is bundled and opaque.",
      generalUseCases: ["Meeting recaps and action items", "Word, Excel, PowerPoint, Teams, and Outlook help", "Enterprise search across work data", "Custom internal agents and process automation"],
      submodels: [
        model("Microsoft 365 Copilot core", "Work assistant", "Main Microsoft 365 Copilot experience grounded in Microsoft Graph and workplace context.", "Best for email, docs, meetings, spreadsheets, and enterprise productivity", "Bundled / enterprise", "Opaque"),
        model("Copilot Studio agents", "Custom", "Custom enterprise agents that connect to internal tools, systems, and workflows.", "Best for operations, approvals, internal support, and workflow automation", "Enterprise variable", "Variable")
      ]
    },
    {
      name: "Meta AI / Llama",
      company: "Meta",
      group: "Chatbots",
      kind: "Open model family",
      bestFor: "Consumer assistants, open-model workflows, social products, and deployable Llama stacks",
      strengths: ["Open models", "Consumer", "Social", "Deployable"],
      api: "Open weights",
      apiNote: "Weights are downloadable; serve yourself or via hosting providers.",
      limits: "You own the hosting, scaling, and safety tuning.",
      generalUseCases: ["Open-model experimentation and deployment", "Everyday assistant use in Meta products", "Custom model hosting and fine-tuning", "Social product AI features"],
      submodels: [
        model("Llama 4 Scout", "Efficient", "Efficient Llama model tier for general assistant tasks and scalable deployment.", "Best for general assistants, integrations, and lower-cost deployments", "Low", "Light"),
        model("Llama 4 Maverick", "Balanced", "More capable Llama model tier for better reasoning, chat quality, and developer experimentation.", "Best for higher-quality open-model chat and analysis", "Medium", "Moderate"),
        model("Llama 4 Behemoth", "Largest", "Largest Llama-family tier for frontier open-model research and high-capability workloads.", "Best for heavyweight open-model experimentation and research", "High", "Heavy")
      ]
    },
    {
      name: "DeepSeek",
      company: "DeepSeek",
      group: "Chatbots",
      kind: "Low-cost open model",
      bestFor: "Low-cost reasoning, coding, technical workflows, and budget-conscious AI apps",
      strengths: ["Cheap", "Coding", "Reasoning", "Open weights"],
      api: "Public API",
      apiNote: "Very low-cost API; open weights also available to self-host.",
      limits: "Smaller multimodal coverage; data-residency considerations for some teams.",
      generalUseCases: ["Code generation and debugging", "Reasoning-heavy prompts", "Budget AI deployments", "Developer experimentation"],
      submodels: [
        model("DeepSeek R1", "Reasoning", "Reasoning-focused model optimized for step-by-step thinking, logic, math, and technical tasks.", "Best for math, logic, coding, and deep reasoning", "Low", "Light"),
        model("DeepSeek V3", "Balanced", "General-purpose DeepSeek model for chat, coding, and broad assistant workflows.", "Best for coding, general productivity, and low-cost assistants", "Very low", "Very light")
      ]
    },
    {
      name: "Mistral",
      company: "Mistral AI",
      group: "Chatbots",
      kind: "Open / enterprise model",
      bestFor: "Open-weight enterprise models, coding agents, private deployments, and efficient multimodal work",
      strengths: ["Open models", "Enterprise", "Coding", "Efficient"],
      api: "Public API + open weights",
      apiNote: "La Plateforme API plus downloadable open-weight models for private hosting.",
      limits: "Frontier quality trails the largest closed models on the hardest tasks.",
      generalUseCases: ["Private AI deployments", "Enterprise copilots", "Low-latency assistants", "Code agents and developer tools"],
      submodels: [
        model("Mistral Large 3", "Flagship open-weight", "Mistral large open-weight flagship multimodal model for reasoning, multilingual work, and enterprise use.", "Best for enterprise reasoning, private deployment, and high-quality open output", "Medium", "Moderate"),
        model("Mistral Medium 3.5", "Efficient agentic", "Frontier-class multimodal model optimized for agentic and coding use cases at lower cost.", "Best for agentic workflows, coding, and cost-aware enterprise apps", "Low", "Light"),
        model("Devstral 2", "Code agents", "Mistral code-agent model for solving software engineering tasks and building developer agents.", "Best for autonomous coding agents and repo tasks", "Low", "Light")
      ]
    },
    {
      name: "Qwen",
      company: "Alibaba / Qwen",
      group: "Chatbots",
      kind: "Open / agentic model",
      bestFor: "Agentic workflows, multilingual tasks, coding, visual agents, and low-cost deployment",
      strengths: ["Agentic", "Open models", "Multilingual", "Coding"],
      api: "Public API + open weights",
      apiNote: "DashScope API plus widely available open weights for self-hosting.",
      limits: "Western tooling and docs are thinner; some models region-gated.",
      generalUseCases: ["Agentic desktop and mobile workflows", "Coding and technical assistants", "Multilingual applications", "Image generation and editing"],
      submodels: [
        model("Qwen 3.5", "Agentic", "Qwen model family focused on agentic AI workflows, large workloads, and visual/desktop task execution.", "Best for agentic apps, multilingual assistants, and automation", "Low", "Light"),
        model("Qwen3-Coder-Plus", "Coding", "Coding-focused Qwen model series for developer workflows and programming tasks.", "Best for code generation, debugging, and coding assistants", "Low", "Light"),
        model("Qwen Image 2.0", "Image", "Qwen image model family for image generation and editing workflows.", "Best for visual generation, edits, thumbnails, and creative assets", "Low", "Moderate")
      ]
    },
    {
      name: "Kimi",
      company: "Moonshot AI",
      group: "Chatbots",
      kind: "Long-context model",
      bestFor: "Long-context work, coding agents, document analysis, websites, and agent swarms",
      strengths: ["Long context", "Coding", "Agents", "Docs"],
      api: "Public API",
      apiNote: "Moonshot API with strong long-context and tool-calling support.",
      limits: "Newer ecosystem; fewer third-party integrations than the majors.",
      generalUseCases: ["Full-stack website generation", "Document and file analysis", "Long-context research", "Coding assistants and codebase tasks"],
      submodels: [
        model("Kimi K2.6", "Latest app model", "Kimi newer app-facing model focused on coding, websites, documents, and agent workflows.", "Best for building websites, analyzing docs, and agent-style workflows", "Medium", "Moderate"),
        model("Kimi K2.5 API", "Long context", "API model promoted for long-context work, tool calling, codebases, and always-on agents.", "Best for long documents, codebases, and API agent workflows", "Low", "Light to moderate"),
        model("Kimi Agent Swarm", "Agents", "Multi-agent workflow mode for larger tasks that benefit from parallel specialized agents.", "Best for large projects, research batches, and complex build workflows", "Medium", "Heavy")
      ]
    },
    {
      name: "Cohere",
      company: "Cohere",
      group: "Chatbots",
      kind: "Enterprise / retrieval",
      bestFor: "Enterprise AI, private deployments, retrieval, search, reranking, and secure workflows",
      strengths: ["Enterprise", "RAG", "Rerank", "Security"],
      api: "Public API + private deploy",
      apiNote: "API plus private/VPC deployment for Command, Embed, and Rerank families.",
      limits: "Less consumer-facing; positioned for enterprise retrieval over open chat.",
      generalUseCases: ["Enterprise search and retrieval", "RAG applications", "Secure business assistants", "Reranking and classification workflows"],
      submodels: [
        model("Command family", "Enterprise LLM", "Cohere enterprise LLM family for secure business automation, private AI workflows, and assistants.", "Best for enterprise copilots and business process automation", "Medium", "Moderate"),
        model("Embed family", "Embeddings", "Embedding models for turning documents and text into searchable vector representations.", "Best for semantic search, RAG, memory, and knowledge bases", "Low", "Light"),
        model("Rerank family", "Retrieval", "Reranking models that improve search quality by sorting retrieved documents by relevance.", "Best for RAG accuracy, search refinement, and document ranking", "Low", "Light")
      ]
    },

    // ----------------------------------------------------------- Coding Agents
    {
      name: "Claude Code",
      company: "Anthropic",
      group: "Coding Agents",
      kind: "Terminal coding agent",
      bestFor: "Long coding sessions, refactors, repo reasoning, and implementation loops",
      strengths: ["Repo reasoning", "Refactors", "Testing", "Agentic"],
      api: "Via Anthropic API",
      apiNote: "Runs on Claude models; programmable through the Claude Agent SDK.",
      limits: "Token usage adds up on big repos; needs scoped permissions.",
      generalUseCases: ["Reading, editing, and testing across a codebase", "Large multi-file refactors", "Implementing features end to end", "Debugging and iterating in the terminal"],
      submodels: [
        model("Claude Code CLI", "Terminal agent", "Agentic coding workflow for reading, editing, testing, and iterating across a codebase from the terminal.", "Best for long coding sessions, refactors, and repo reasoning", "Medium", "Moderate to heavy")
      ]
    },
    {
      name: "OpenAI Codex CLI",
      company: "OpenAI",
      group: "Coding Agents",
      kind: "Terminal coding agent",
      bestFor: "Repo audits, bug fixes, code generation, and terminal-first development",
      strengths: ["Local repo", "Bug fixes", "Codegen", "Terminal"],
      api: "Via OpenAI API",
      apiNote: "Backed by GPT coding models; extensible with local skills/plugins.",
      limits: "Quality and cost track the underlying GPT tier you select.",
      generalUseCases: ["Local terminal code changes", "Repo audits and bug fixes", "Code generation in a chosen directory", "Running and verifying changes"],
      submodels: [
        model("Codex CLI", "Terminal agent", "Local terminal coding agent that can read, change, and run code in a selected directory.", "Best for repo audits, bug fixes, and terminal-first development", "Medium", "Moderate")
      ]
    },
    {
      name: "Cursor / Windsurf",
      company: "Anysphere / Codeium",
      group: "Coding Agents",
      kind: "Agent IDE",
      bestFor: "Interactive coding, refactors, and local code understanding inside an editor",
      strengths: ["IDE-native", "Multi-file", "Inline edits", "Context"],
      api: "Bring your own key",
      apiNote: "IDE layer over multiple model providers; configure your own API keys.",
      limits: "Subscription for premium models; quality depends on model choice.",
      generalUseCases: ["Editing files with full project context", "Interactive refactors", "Inline code generation and chat", "Running workflows close to the code"],
      submodels: [
        model("Cursor / Windsurf / Continue", "Agent IDE", "IDE-native agents for reading projects, editing files, and running workflows close to the code.", "Best for interactive coding, refactors, and local code understanding", "Medium", "Moderate")
      ]
    },
    {
      name: "Aider",
      company: "Open source",
      group: "Coding Agents",
      kind: "CLI pair programmer",
      bestFor: "Small patches, terminal coding, and diff-driven work",
      strengths: ["Git-aware", "Diff edits", "Lightweight", "Open source"],
      api: "Bring your own key",
      apiNote: "Open-source CLI that calls the model API of your choice.",
      limits: "Best for focused changes; less autonomous than full agent IDEs.",
      generalUseCases: ["Git-aware command-line edits", "Focused file changes and patches", "Diff-driven coding loops", "Terminal pair programming"],
      submodels: [
        model("Aider", "CLI pair programmer", "Git-aware command-line coding assistant for focused file changes and patch workflows.", "Best for small patches, terminal coding, and diff-driven work", "Low", "Light")
      ]
    },
    {
      name: "Gemini CLI / Code Assist",
      company: "Google",
      group: "Coding Agents",
      kind: "Developer assistant",
      bestFor: "Google-stack development, code help, and cloud-connected workflows",
      strengths: ["Google stack", "MCP config", "Open source", "Cloud"],
      api: "Via Google AI / Vertex",
      apiNote: "Open-source terminal agent with MCP server configuration via settings.",
      limits: "Most valuable inside the Google Cloud and Workspace ecosystem.",
      generalUseCases: ["Terminal coding with Gemini", "Cloud-connected developer workflows", "Configuring MCP tools in the CLI", "Google-stack development help"],
      submodels: [
        model("Gemini CLI / Code Assist", "Developer assistant", "Open-source terminal agent with MCP server configuration through settings.", "Best for Google-stack development and cloud-connected workflows", "Low", "Light to moderate")
      ]
    },

    // --------------------------------------------------------- Research Agents
    {
      name: "Perplexity",
      company: "Perplexity",
      group: "Research Agents",
      kind: "Search-first assistant",
      bestFor: "Cited research, current answers, discovery, model switching, and search-first work",
      strengths: ["Citations", "Search", "Current info", "Model choice"],
      api: "Public API (Sonar)",
      apiNote: "Sonar API for web-grounded, cited answers; app lets you switch models.",
      limits: "Answer quality depends on the chosen model and live source quality.",
      generalUseCases: ["Fast web research with sources", "Fact-checking and current-events answers", "Market and competitor scans", "Comparing answers across model families"],
      submodels: [
        model("Sonar", "Native search", "Perplexity search-first model line for web-grounded answers and cited retrieval.", "Best for fast cited web answers and discovery", "Medium", "Moderate"),
        model("Frontier model options", "Reasoning", "Inside Perplexity you can route to top OpenAI, Anthropic, or Google models for harder questions.", "Best for deep research and harder analytical questions", "High", "Heavy")
      ]
    },
    {
      name: "Deep Research modes",
      company: "OpenAI / Google / Anthropic",
      group: "Research Agents",
      kind: "Autonomous research agent",
      bestFor: "Multi-step research that browses, reads many sources, and writes a cited report",
      strengths: ["Multi-step", "Browses sources", "Synthesis", "Cited"],
      api: "Via each provider",
      apiNote: "Agentic research modes built into ChatGPT, Gemini, and Claude.",
      limits: "Slow and token-heavy; can over-trust weak sources without review.",
      generalUseCases: ["Long, source-backed research reports", "Competitive and market landscape scans", "Literature and topic deep dives", "Synthesizing many documents at once"],
      submodels: [
        model("Deep Research agent", "Research agent", "Autonomous mode that plans, browses, reads, and synthesizes many sources into a cited report.", "Best for source-backed reports and complex research questions", "High", "Very heavy")
      ]
    },
    {
      name: "Microsoft 365 Researcher",
      company: "Microsoft",
      group: "Research Agents",
      kind: "Enterprise research agent",
      bestFor: "Research grounded in both the web and your internal work files",
      strengths: ["Work data", "Web + internal", "Synthesis", "Enterprise"],
      api: "Enterprise only",
      apiNote: "Part of Microsoft 365 Copilot; no standalone public API.",
      limits: "Requires Copilot licensing and a Microsoft 365 tenant.",
      generalUseCases: ["Market research and synthesis", "Source-backed internal reports", "Combining web and company knowledge", "Strategy and analysis work"],
      submodels: [
        model("Researcher", "Deep research", "Research agent for gathering, analyzing, and summarizing information from web and work files.", "Best for market research, synthesis, and source-backed reports", "Bundled / enterprise", "Heavy")
      ]
    },

    // ---------------------------------------------------------- Browser Agents
    {
      name: "Agent-Browser",
      company: "Open tooling",
      group: "Browser Agents",
      kind: "CLI browser tool",
      bestFor: "Form filling, clicking, browsing, and web automation with fewer tokens",
      strengths: ["Human-like", "Token-light", "Forms", "Clicking"],
      api: "Tool / library",
      apiNote: "CLI browser tool an agent drives; pairs with any model backend.",
      limits: "Logged-in sessions are high-trust; scope automation carefully.",
      generalUseCases: ["Filling and submitting web forms", "Clicking through multi-step flows", "Lightweight web automation", "Human-like browsing for agents"],
      submodels: [
        model("Agent-Browser", "Browser tool", "CLI browser tool for human-like web interaction with fewer tokens.", "Best for form filling, clicking, browsing, and web automation", "Low", "Light")
      ]
    },
    {
      name: "Browser / Playwright MCP",
      company: "Microsoft / OSS",
      group: "Browser Agents",
      kind: "Browser automation connector",
      bestFor: "Frontend QA, web automation, and browser control via MCP",
      strengths: ["Automation", "QA", "MCP", "Deterministic"],
      api: "MCP connector",
      apiNote: "Exposes browser control to any MCP-compatible agent.",
      limits: "Needs a managed browser context; flaky sites still break flows.",
      generalUseCases: ["Driving browsers to click, type, and navigate", "Filling forms and testing pages", "Inspecting UI behavior", "End-to-end frontend QA"],
      submodels: [
        model("Browser / Playwright MCP", "Browser automation", "Lets agents control browsers, click buttons, fill forms, test pages, and inspect UI behavior.", "Best for frontend QA, web automation, and browser control", "Free / open", "Light")
      ]
    },
    {
      name: "Computer-use agents",
      company: "OpenAI / Anthropic",
      group: "Browser Agents",
      kind: "Screen + browser control",
      bestFor: "Operating a browser or desktop visually, like a person, for end-to-end tasks",
      strengths: ["Vision", "Clicks UI", "End-to-end", "General"],
      api: "Via each provider",
      apiNote: "Computer-use / operator capabilities exposed through provider APIs.",
      limits: "Slower and error-prone on complex UIs; needs guardrails and review.",
      generalUseCases: ["Operating web apps without an API", "Multi-step booking and checkout flows", "Visual UI navigation", "Automating tasks across real software"],
      submodels: [
        model("Computer / browser use", "UI agent", "Vision-driven agent that controls a browser or desktop by reading the screen and clicking like a user.", "Best for tasks where no API exists and the UI must be driven directly", "High", "Very heavy")
      ]
    },

    // -------------------------------------------------------- Automation Agents
    {
      name: "n8n AI workflows",
      company: "n8n",
      group: "Automation Agents",
      kind: "Workflow automation builder",
      bestFor: "Scheduled tasks and backend automations that chain AI with apps and APIs",
      strengths: ["Visual", "Integrations", "Webhooks", "Self-host"],
      api: "Self-host / cloud",
      apiNote: "Connects AI calls with APIs, databases, email, and webhooks; self-hostable.",
      limits: "Complex flows get hard to debug; you own hosting if self-managed.",
      generalUseCases: ["Scheduled and event-driven automations", "Connecting AI to apps and databases", "Webhook and email workflows", "Backend glue between services"],
      submodels: [
        model("n8n AI workflows", "Automation builder", "Visual workflow automation connecting AI calls with APIs, databases, email, webhooks, and apps.", "Best for scheduled tasks and backend automations", "Low", "Light")
      ]
    },
    {
      name: "LangGraph / LangChain",
      company: "LangChain",
      group: "Automation Agents",
      kind: "Agent framework",
      bestFor: "Production agent apps with multi-step logic, tool calls, and memory flows",
      strengths: ["Multi-step", "Tool calls", "Memory", "Graphs"],
      api: "Library / SDK",
      apiNote: "Code frameworks for graph-based agent workflows over any model API.",
      limits: "Abstraction overhead; you maintain the orchestration code.",
      generalUseCases: ["Multi-step agents and tool calling", "Graph-based workflow logic", "Memory and state flows", "Production agent applications"],
      submodels: [
        model("LangGraph / LangChain", "Agent framework", "Frameworks for multi-step agents, tool calls, memory flows, and graph-based workflows.", "Best for production agent apps and workflow logic", "Free / open", "Light")
      ]
    },
    {
      name: "Copilot Studio agents",
      company: "Microsoft",
      group: "Automation Agents",
      kind: "Enterprise agent builder",
      bestFor: "Internal support, approvals, and workflow automation across enterprise systems",
      strengths: ["Enterprise", "Connectors", "Low-code", "Governed"],
      api: "Enterprise only",
      apiNote: "Builds governed agents that connect to internal tools and Microsoft Graph.",
      limits: "Tied to Microsoft licensing; less flexible than code frameworks.",
      generalUseCases: ["Custom internal support agents", "Approvals and operations automation", "Connecting agents to enterprise systems", "Governed workflow automation"],
      submodels: [
        model("Copilot Studio agents", "Custom agents", "Custom enterprise agents that connect to internal tools, systems, and workflows.", "Best for operations, approvals, and internal support automation", "Enterprise variable", "Variable")
      ]
    },
    {
      name: "Compose.ai",
      company: "Compose.ai",
      group: "Automation Agents",
      kind: "Email assistant",
      bestFor: "Email drafting, reply acceleration, and outreach inside your inbox",
      strengths: ["Email", "Autocomplete", "Fast replies", "Inbox-native"],
      api: "App / extension",
      apiNote: "Browser extension; no developer API.",
      limits: "Scoped to email writing rather than general automation.",
      generalUseCases: ["Writing follow-up emails faster", "Reply acceleration in the inbox", "Outreach drafting", "Repetitive email automation"],
      submodels: [
        model("Compose.ai", "Email assistant", "Speeds up writing follow-up emails directly inside your inbox.", "Best for email drafting, reply acceleration, and outreach", "Low", "Light")
      ]
    },
    {
      name: "Otter.ai",
      company: "Otter",
      group: "Automation Agents",
      kind: "Meeting notes automation",
      bestFor: "Meeting summaries, notes, and action items captured automatically",
      strengths: ["Transcription", "Summaries", "Action items", "Live"],
      api: "App + API",
      apiNote: "Records, transcribes, and summarizes meetings; integrations available.",
      limits: "Accuracy drops with crosstalk, accents, and poor audio.",
      generalUseCases: ["Automatic meeting recording and transcription", "Meeting summaries and notes", "Action-item capture", "Searchable meeting history"],
      submodels: [
        model("Otter.ai", "Meeting notes", "Automatically records, transcribes, and summarizes meetings.", "Best for meeting summaries, notes, and action items", "Low", "Light")
      ]
    },

    // --------------------------------------------------------------- CLI Agents
    {
      name: "Railway CLI",
      company: "Railway",
      group: "CLI Agents",
      kind: "Deploy CLI",
      bestFor: "Backend/frontend deployment and project operations from the terminal",
      strengths: ["Deploy", "Env vars", "Logs", "Services"],
      api: "CLI + API",
      apiNote: "Command-line tool plus a project API for automation.",
      limits: "Scoped to the Railway platform.",
      generalUseCases: ["Deploying and managing apps", "Managing services and env vars", "Tailing logs", "Scripting project operations"],
      submodels: [
        model("Railway CLI", "Deploy CLI", "Command-line tool for deploying and managing apps, services, env vars, and logs on Railway.", "Best for backend/frontend deployment and project operations", "Free / open", "Light")
      ]
    },
    {
      name: "Vercel CLI",
      company: "Vercel",
      group: "CLI Agents",
      kind: "Frontend deploy CLI",
      bestFor: "React/Next.js deployments and preview environments",
      strengths: ["Frontend", "Previews", "Serverless", "Fast"],
      api: "CLI + API",
      apiNote: "Deploys apps and serverless functions; REST API for automation.",
      limits: "Best fit for frontend and serverless workloads.",
      generalUseCases: ["Deploying frontend apps", "Preview deployments", "Serverless functions", "CI/CD scripting"],
      submodels: [
        model("Vercel CLI", "Frontend deploy CLI", "Deploys frontend apps and serverless functions from the terminal.", "Best for React/Next.js deployments and previews", "Free / open", "Light")
      ]
    },
    {
      name: "GitHub CLI",
      company: "GitHub",
      group: "CLI Agents",
      kind: "Repo operations CLI",
      bestFor: "PR workflows, issue management, and developer automation",
      strengths: ["PRs", "Issues", "Actions", "Auth"],
      api: "CLI + REST/GraphQL",
      apiNote: "Manages repos from the terminal; backed by the GitHub API.",
      limits: "Requires auth and appropriate repo permissions.",
      generalUseCases: ["Managing pull requests", "Issue triage and management", "Running and inspecting Actions", "Developer automation scripts"],
      submodels: [
        model("GitHub CLI", "Repo operations CLI", "Manages repos, issues, pull requests, auth, and GitHub Actions from the terminal.", "Best for PR workflows, issue management, and developer automation", "Free / open", "Light")
      ]
    },

    // ------------------------------------------------------- MCP-Compatible Tools
    {
      name: "Model Context Protocol",
      company: "Open standard",
      group: "MCP-Compatible Tools",
      kind: "Tool connection standard",
      bestFor: "Safe, structured tool and data access for agents",
      strengths: ["Standard", "Tools", "Data", "Interoperable"],
      api: "Open protocol",
      apiNote: "A shared standard so agents can connect to tools, files, DBs, and APIs.",
      limits: "Only as safe as the servers you trust; review permissions.",
      generalUseCases: ["Connecting agents to external tools", "Standardized data and file access", "Reusable connectors across agents", "Vetted tool integrations"],
      submodels: [
        model("MCP core + Registry", "Standard + discovery", "A standard way for agents to connect with tools, files, databases, browsers, APIs, and external systems, with a registry to discover vetted servers.", "Best for safe, structured tool and data access", "Free / open", "Very light")
      ]
    },
    {
      name: "Filesystem MCP",
      company: "OSS",
      group: "MCP-Compatible Tools",
      kind: "Local file connector",
      bestFor: "Local projects, document automation, and controlled file edits",
      strengths: ["Files", "Scoped", "Local", "Safe"],
      api: "MCP connector",
      apiNote: "Reads, writes, and organizes files within allowed directories.",
      limits: "Scope tightly — broad filesystem access is risky.",
      generalUseCases: ["Reading and writing project files", "Document automation", "Controlled, scoped file edits", "Local knowledge workflows"],
      submodels: [
        model("Filesystem MCP", "File connector", "Allows an agent to read, write, and organize files within allowed directories.", "Best for local projects, document automation, and controlled file edits", "Free / open", "Very light")
      ]
    },
    {
      name: "GitHub MCP",
      company: "GitHub",
      group: "MCP-Compatible Tools",
      kind: "Repository connector",
      bestFor: "Codebase automation, issue triage, and PR review",
      strengths: ["Repos", "Issues", "PRs", "Context"],
      api: "MCP connector",
      apiNote: "Lets agents inspect repos, issues, PRs, commits, and project context.",
      limits: "Grant least-privilege repo scopes only.",
      generalUseCases: ["Inspecting repos and project context", "Issue triage", "PR review and automation", "Codebase reasoning over GitHub data"],
      submodels: [
        model("GitHub MCP", "Repo connector", "Lets agents inspect repos, issues, pull requests, commits, and project context.", "Best for codebase automation, issue triage, and PR review", "Free / open", "Very light")
      ]
    },
    {
      name: "Database MCP",
      company: "OSS",
      group: "MCP-Compatible Tools",
      kind: "Data connector",
      bestFor: "Analytics dashboards, admin tools, and backend inspection",
      strengths: ["SQL", "Postgres", "Analytics", "Backend"],
      api: "MCP connector",
      apiNote: "Connects agents to Postgres, SQLite, and other structured systems.",
      limits: "Use read-only roles for safety; gate writes behind approval.",
      generalUseCases: ["Querying databases for insights", "Building admin and analytics tools", "Backend inspection", "Data-grounded agent answers"],
      submodels: [
        model("Database MCP", "Data connector", "Connects agents to databases like Postgres, SQLite, or other structured systems.", "Best for analytics dashboards, admin tools, and backend inspection", "Free / open", "Light")
      ]
    },
    {
      name: "Claude Agent SDK",
      company: "Anthropic",
      group: "MCP-Compatible Tools",
      kind: "Programmable agent SDK",
      bestFor: "Custom agent apps, code agents, and tool orchestration",
      strengths: ["Programmable", "Tools", "Loops", "MCP-native"],
      api: "SDK + API",
      apiNote: "Build agents that read files, run commands, search, edit code, and loop.",
      limits: "You design the guardrails, retries, and cost controls.",
      generalUseCases: ["Building custom agent applications", "Code agents and tool orchestration", "Looping multi-step tasks", "Wiring MCP tools into agents"],
      submodels: [
        model("Claude Agent SDK", "Agent SDK", "SDK for agents that can read files, run commands, search the web, edit code, and loop through tasks.", "Best for custom agent apps, code agents, and tool orchestration", "Medium", "Moderate")
      ]
    },
    {
      name: "Agent infrastructure",
      company: "Community",
      group: "MCP-Compatible Tools",
      kind: "Memory / email / skills",
      bestFor: "Agent memory, programmatic email, and reusable skills",
      strengths: ["Memory", "Email", "Skills", "Retrieval"],
      api: "Tools / libraries",
      apiNote: "Building blocks like agent email, markdown memory search, and skill repos.",
      limits: "Mix-and-match maturity; vet each component before trusting it.",
      generalUseCases: ["Programmatic agent email (AgentMail)", "Local markdown memory and retrieval (QMD)", "Discovering and installing skills (ClawHub)", "Composing agent infrastructure"],
      submodels: [
        model("AgentMail", "Agent email", "Dedicated email client for agents to send and receive email programmatically.", "Best for agent outbound/inbound email workflows", "Low", "Light"),
        model("QMD", "Memory / retrieval", "Local hybrid search engine for markdown memory using keyword, vector, and reranking.", "Best for agent memory and local knowledge search", "Free / open", "Light"),
        model("ClawHub", "Skill repository", "Repository for finding and installing community-built skills.", "Best for skill discovery and workflow setup", "Free / open", "Very light")
      ]
    }
  ];

  const categoryOrder = [
    "Chatbots",
    "Coding Agents",
    "Research Agents",
    "Browser Agents",
    "Automation Agents",
    "CLI Agents",
    "MCP-Compatible Tools"
  ];

  const categoryCopy = {
    "Chatbots": "General-purpose conversational assistants and the model families that power them.",
    "Coding Agents": "Agents that read, write, run, test, and refactor code across a repo.",
    "Research Agents": "Search-first and deep-research agents that gather, cite, and synthesize information.",
    "Browser Agents": "Agents that drive a real browser — click, type, fill forms, and test UI.",
    "Automation Agents": "Workflow and automation builders that chain AI with apps, APIs, and schedules.",
    "CLI Agents": "Terminal-first tools for deploying, operating, and managing projects.",
    "MCP-Compatible Tools": "Model Context Protocol connectors and SDKs that give agents safe tool and data access."
  };

  const costMap = { "Very low": 1, "Free / open": 1, "Low": 2, "Open weights": 2, "Medium": 3, "High": 4, "Subscription / tiered": 3, "Bundled / enterprise": 3, "Enterprise variable": 3 };
  const burnMap = { "Very light": 1, "Light": 2, "Light to moderate": 2.5, "Moderate": 3, "Moderate to heavy": 3.5, "Heavy": 4, "Very heavy": 5, "Opaque": 3, "Variable": 3 };
  const categoryFilters = ["All"].concat(categoryOrder);
  const state = { category: "All", query: "", openCards: new Set(), collapsedGroups: new Set(), activeModels: {} };
  let rendered = false;

  function model(name, badge, desc, use, cost, burn) {
    return { name, badge, desc, use, cost, burn };
  }

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function filteredAis() {
    const q = state.query.trim().toLowerCase();
    return ais.filter(ai => {
      const categoryMatch = state.category === "All" || ai.group === state.category;
      const haystack = [
        ai.name,
        ai.company,
        ai.group,
        ai.kind,
        ai.bestFor,
        ai.api,
        ai.apiNote,
        ai.limits,
        ...ai.strengths,
        ...ai.generalUseCases,
        ...ai.submodels.flatMap(m => [m.name, m.badge, m.desc, m.use, m.cost, m.burn])
      ].join(" ").toLowerCase();
      return categoryMatch && (!q || haystack.includes(q));
    });
  }

  function graphData() {
    return filteredAis().flatMap(ai => ai.submodels.map(m => ({
      platform: ai.name,
      name: m.name,
      cost: costMap[m.cost] || 3,
      burn: burnMap[m.burn] || 3,
      costLabel: m.cost,
      burnLabel: m.burn
    })));
  }

  function render() {
    const root = document.getElementById("ai-landscape-root");
    if (!root) return;
    const list = filteredAis();
    root.innerHTML = `
      <div class="ai-shell">
        <header class="ai-header">
          <div>
            <div class="ai-kicker">Agent Office model & agent catalog</div>
            <h1 class="ai-title">Choose the right AI agent for the job</h1>
            <p class="ai-subtitle">A working catalog of AI models and agents grouped by category — chatbots, coding, research, browser, automation, CLI, and MCP tools. Each card shows what it is best for, its strengths, its limits, whether it has API access, and a relative cost tier. Cost comparison graph is at the bottom.</p>
          </div>
          <div class="ai-notice-stack">
            <div class="ai-notice warning">Models and agents change frequently. Treat these as editable catalog entries and refresh provider data before making buying decisions.</div>
            <div class="ai-notice">Security note: only connect trusted MCP servers; review permissions before giving agents file, browser, database, repo, or API access.</div>
          </div>
        </header>

        <section class="ai-toolbar" aria-label="AI landscape filters">
          <input id="ai-search" class="ai-search" value="${esc(state.query)}" placeholder="Search agents, models, cost, API, or use cases" />
          <div class="ai-filter-row">${categoryFilters.map(cat => pill("category", cat, state.category === cat)).join("")}</div>
        </section>

        ${categoryGroupsSection(list)}
        ${matrixSection()}
        ${chartSection()}
      </div>
    `;
    bindControls(root);
    rendered = true;
  }

  function pill(type, value, active) {
    return `<button class="ai-pill ${active ? "active" : ""}" data-${type}="${esc(value)}" type="button">${esc(value)}</button>`;
  }

  function categoryGroupsSection(list) {
    const groupsToShow = categoryOrder.filter(cat => list.some(ai => ai.group === cat));
    if (!groupsToShow.length) {
      return `<section class="ai-section"><p class="ai-section-copy">No agents match the current search.</p></section>`;
    }
    return groupsToShow.map(cat => categoryGroup(cat, list.filter(ai => ai.group === cat))).join("");
  }

  function categoryGroup(cat, items) {
    const collapsed = state.collapsedGroups.has(cat);
    return `
      <section class="ai-cat-group ${collapsed ? "collapsed" : ""}" data-cat-group="${esc(cat)}">
        <button class="ai-cat-head" type="button" data-toggle-group="${esc(cat)}">
          <div>
            <h2 class="ai-cat-title">${esc(cat)}</h2>
            <p class="ai-cat-copy">${esc(categoryCopy[cat] || "")}</p>
          </div>
          <div class="ai-cat-meta">
            <span class="ai-count">${items.length} card${items.length === 1 ? "" : "s"}</span>
            <span class="ai-chevron">▾</span>
          </div>
        </button>
        <div class="ai-cat-body">
          <div class="ai-grid">${items.map(aiCard).join("")}</div>
        </div>
      </section>
    `;
  }

  function aiCard(ai) {
    const open = state.openCards.has(ai.name);
    const activeName = state.activeModels[ai.name] || ai.submodels[0].name;
    const active = ai.submodels.find(m => m.name === activeName) || ai.submodels[0];
    const hasTabs = ai.submodels.length > 1;
    return `
      <article class="ai-card ${open ? "open" : ""}" data-ai-card="${esc(ai.name)}">
        <button class="ai-card-button" type="button" data-toggle-card="${esc(ai.name)}">
          <div class="ai-card-top">
            <div>
              <div class="ai-company">${esc(ai.company)}</div>
              <div class="ai-name">${esc(ai.name)}</div>
            </div>
            <div class="ai-category">${esc(ai.kind)}</div>
          </div>
          <p class="ai-desc">${esc(ai.bestFor)}</p>
          <div class="ai-tags">
            <span class="ai-tag ai-tag-api">API: ${esc(ai.api)}</span>
            ${ai.strengths.map(tag => `<span class="ai-tag">${esc(tag)}</span>`).join("")}
          </div>
        </button>
        <div class="ai-card-body">
          ${hasTabs ? `<div class="ai-model-tabs">${ai.submodels.map(m => `<button class="ai-pill ${m.name === active.name ? "active" : ""}" data-model-ai="${esc(ai.name)}" data-model-name="${esc(m.name)}" type="button">${esc(m.name)}</button>`).join("")}</div>` : ""}
          <div class="ai-model-detail">
            <div class="ai-model-title"><span>${esc(active.name)}</span><span>${esc(active.badge)}</span></div>
            <p class="ai-model-copy">${esc(active.desc)}</p>
            <div class="ai-metrics">
              <div class="ai-metric"><span>Token Cost</span><strong>${esc(active.cost)}</strong></div>
              <div class="ai-metric"><span>API Burn</span><strong>${esc(active.burn)}</strong></div>
            </div>
            <p class="ai-model-copy"><strong style="color:#c7d2fe;">Use case:</strong> ${esc(active.use)}</p>
          </div>
          <div class="ai-facts">
            <div class="ai-metric"><span>API access</span><strong>${esc(ai.api)}</strong></div>
            <div class="ai-metric"><span>Limits</span><strong>${esc(ai.limits)}</strong></div>
          </div>
          <p class="ai-model-copy ai-api-note">${esc(ai.apiNote)}</p>
          <ul class="ai-use-list">${ai.generalUseCases.map(use => `<li>${esc(use)}</li>`).join("")}</ul>
        </div>
      </article>
    `;
  }

  function matrixSection() {
    const rows = [
      ["Hard reasoning", "ChatGPT / Claude", "Gemini / Grok"],
      ["Coding agent", "Claude Code / Codex CLI", "Cursor / Aider"],
      ["Current web research", "Perplexity", "Deep Research modes"],
      ["Browser automation", "Playwright MCP / Agent-Browser", "Computer-use agents"],
      ["Workflow automation", "n8n / LangGraph", "Copilot Studio"],
      ["Deploy from terminal", "Railway / Vercel CLI", "GitHub CLI"],
      ["Safe tool access", "MCP connectors", "Claude Agent SDK"],
      ["Low-cost open model", "DeepSeek / Qwen", "Mistral / Llama"]
    ];
    return `
      <section class="ai-section ai-panel" style="padding:18px;">
        <h2 class="ai-section-title">Quick recommendation matrix</h2>
        <p class="ai-section-copy">Fastest way to see what to reach for by job.</p>
        <table class="ai-matrix">
          <thead><tr><th>Need</th><th>Best pick</th><th>Strong alt</th></tr></thead>
          <tbody>${rows.map(row => `<tr><td>${esc(row[0])}</td><td>${esc(row[1])}</td><td>${esc(row[2])}</td></tr>`).join("")}</tbody>
        </table>
      </section>
    `;
  }

  function chartSection() {
    const dots = graphData().map(point => {
      const left = ((point.cost - 0.5) / 4) * 100;
      const bottom = ((point.burn - 0.5) / 5) * 100;
      const label = `${point.name} / ${point.platform} / Cost: ${point.costLabel} / Burn: ${point.burnLabel}`;
      return `<span class="ai-dot" style="left:${left}%; bottom:${bottom}%;" data-label="${esc(label)}"></span>`;
    }).join("");
    return `
      <section class="ai-section">
        <div class="ai-section-head">
          <div>
            <h2 class="ai-section-title">API cost comparison — cost vs API burn</h2>
            <p class="ai-section-copy">Each dot is a model or agent. Bottom-left is cheaper and lighter; top-right is expensive and heavy. Relative tiers, not exact billing quotes. Filtered by: ${esc(state.category)}</p>
          </div>
        </div>
        <div class="ai-chart" aria-label="Cost versus API burn scatter plot">${dots}</div>
      </section>
    `;
  }

  function bindControls(root) {
    const search = root.querySelector("#ai-search");
    if (search) {
      search.addEventListener("input", event => {
        state.query = event.target.value;
        render();
        const nextSearch = document.getElementById("ai-search");
        if (nextSearch) {
          nextSearch.focus();
          nextSearch.setSelectionRange(nextSearch.value.length, nextSearch.value.length);
        }
      });
    }
    root.querySelectorAll("[data-category]").forEach(button => button.addEventListener("click", () => {
      state.category = button.dataset.category;
      render();
    }));
    root.querySelectorAll("[data-toggle-group]").forEach(button => button.addEventListener("click", () => {
      const name = button.dataset.toggleGroup;
      if (state.collapsedGroups.has(name)) state.collapsedGroups.delete(name);
      else state.collapsedGroups.add(name);
      render();
    }));
    root.querySelectorAll("[data-toggle-card]").forEach(button => button.addEventListener("click", () => {
      const name = button.dataset.toggleCard;
      if (state.openCards.has(name)) state.openCards.delete(name);
      else state.openCards.add(name);
      render();
    }));
    root.querySelectorAll("[data-model-ai]").forEach(button => button.addEventListener("click", event => {
      event.stopPropagation();
      state.openCards.add(button.dataset.modelAi);
      state.activeModels[button.dataset.modelAi] = button.dataset.modelName;
      render();
    }));
  }

  function addAiNavItem() {
    const nav = document.querySelector(".nav");
    if (!nav || nav.querySelector("[data-ai-landscape-nav]")) return;
    const firstWrap = nav.querySelector(".nav-items-wrap");
    if (!firstWrap) return;
    const itemEl = document.createElement("div");
    itemEl.className = "nav-item";
    itemEl.setAttribute("data-ai-landscape-nav", "true");
    itemEl.setAttribute("onclick", "switchView('ai-landscape', this)");
    itemEl.innerHTML = '<span class="icon">AI</span> AI Landscape';
    const dropbox = Array.from(firstWrap.children).find(el => String(el.getAttribute("onclick") || "").includes("dropbox"));
    firstWrap.insertBefore(itemEl, dropbox || null);
  }

  function boot() {
    // Only add the AI Landscape nav item; do NOT consolidate the whole sidebar
    // into one "Site Menu" — the nav keeps its own structure (Apps & Sites is the
    // single dropdown, with per-site Railway/GitHub sub-dropdowns).
    addAiNavItem();
    try {
      if (typeof VIEW_HANDLERS !== "undefined") {
        VIEW_HANDLERS["ai-landscape"] = { enter: () => render(), focus: false };
      }
    } catch (error) {
      console.warn("AI Landscape could not register with Agent Office router.", error);
    }
  }

  window.AILandscape = { render, boot };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  if (rendered) render();
})();
