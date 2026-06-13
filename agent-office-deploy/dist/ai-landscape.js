(function () {
  const ais = [
    {
      name: "ChatGPT",
      company: "OpenAI",
      category: "General / Reasoning",
      bestFor: "Reasoning, coding, multimodal work, agents, writing, and daily productivity",
      strengths: ["Reasoning", "Coding", "Multimodal", "Agents"],
      status: "Updated",
      generalUseCases: ["Deep reasoning and complex problem solving", "Coding, debugging, and repo planning", "Writing, editing, summarization, and research", "Image, voice, and multimodal workflows", "Agentic task execution and product prototypes"],
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
      category: "Writing / Coding / Analysis",
      bestFor: "Long-form writing, careful analysis, codebases, agents, and thoughtful reasoning",
      strengths: ["Writing", "Coding", "Reasoning", "Long context"],
      status: "Updated",
      generalUseCases: ["Long-form writing and editing", "Codebase reasoning and agentic coding", "Business planning and analysis", "Document summarization and rewriting", "Careful explanations and safer assistant behavior"],
      submodels: [
        model("Claude Opus 4.7", "Flagship", "Top Claude model tier for hard reasoning, coding, long-running tasks, and premium-quality outputs.", "Best for hardest coding jobs, strategic analysis, and deep writing", "High", "Heavy"),
        model("Claude Sonnet 4.6", "Balanced", "Updated Sonnet-family model focused on coding, agents, speed, and high-quality everyday work.", "Best for most day-to-day coding, writing, analysis, and assistant workflows", "Medium", "Moderate"),
        model("Claude 3.7 Sonnet", "Hybrid reasoning", "Reasoning-capable Sonnet model that can spend more effort on harder problems when needed.", "Best for structured reasoning, complex planning, and careful technical work", "Medium", "Moderate to heavy"),
        model("Claude 3.5 Haiku", "Fast", "Lightweight Claude model tuned for speed, throughput, and lower-cost assistant flows.", "Best for summaries, support bots, routing, and quick responses", "Low", "Light")
      ]
    },
    {
      name: "Gemini",
      company: "Google",
      category: "Workspace / Agents / Multimodal",
      bestFor: "Google apps, coding, agents, multimodal work, search-linked productivity, and media creation",
      strengths: ["Google stack", "Agents", "Multimodal", "Coding"],
      status: "New I/O updates",
      generalUseCases: ["Drafting in Gmail, Docs, Sheets, and Slides", "Search-connected answers and productivity", "Agentic workflows through Google ecosystem", "Coding and long-duration AI tasks", "Video, audio, image, and multimodal creation"],
      submodels: [
        model("Gemini 3.5 Flash", "Latest fast agentic", "Newer Gemini model promoted for faster agentic behavior, coding, and responsive everyday AI use.", "Best for fast assistants, agents, coding, and Google app productivity", "Low", "Light to moderate"),
        model("Gemini 3.5 Pro", "Upcoming / Pro", "Higher-end Gemini 3.5 tier expected for stronger reasoning, coding, and power-user workflows.", "Best for advanced reasoning, research, and complex developer workflows", "Medium", "Moderate"),
        model("Gemini 3", "Core frontier", "Gemini 3 family emphasizes stronger reasoning, multimodal capability, and broad Google product integration.", "Best for rich multimodal tasks, assistant workflows, and Google ecosystem work", "Medium", "Moderate"),
        model("Gemini Omni Flash", "Create anything", "Generative media family designed to create video/audio outputs from text, images, video, or audio inputs.", "Best for video generation, audio/video remixes, Shorts, and creative media workflows", "High", "Heavy"),
        model("Gemini Spark", "Cloud agent", "Google proactive cloud agent concept that can work across Google apps and run tasks in the background.", "Best for proactive planning, email/docs tasks, and background productivity workflows", "Subscription / tiered", "Variable")
      ]
    },
    {
      name: "Microsoft 365 Copilot",
      company: "Microsoft",
      category: "Enterprise / Office",
      bestFor: "Work documents, enterprise knowledge, meetings, secure workflows, and internal agents",
      strengths: ["Enterprise", "Office", "Meetings", "Work data"],
      status: "Enterprise active",
      generalUseCases: ["Meeting recaps and action items", "Word, Excel, PowerPoint, Teams, and Outlook help", "Enterprise search across work data", "Reports grounded in company context", "Custom internal agents and process automation"],
      submodels: [
        model("Microsoft 365 Copilot core", "Work assistant", "Main Microsoft 365 Copilot experience grounded in Microsoft Graph and workplace context.", "Best for email, docs, meetings, spreadsheets, and enterprise productivity", "Bundled / enterprise", "Opaque"),
        model("Researcher", "Deep research", "Research agent for gathering, analyzing, and summarizing information from web and work files.", "Best for market research, synthesis, and source-backed reports", "Bundled / enterprise", "Heavy"),
        model("Analyst", "Analysis", "Reasoning-focused business analysis agent for complex data and multistep work problems.", "Best for data interpretation, trend analysis, and strategy work", "Bundled / enterprise", "Heavy"),
        model("Copilot Studio agents", "Custom", "Custom enterprise agents that connect to internal tools, systems, and workflows.", "Best for operations, approvals, internal support, and workflow automation", "Enterprise variable", "Variable")
      ]
    },
    {
      name: "Perplexity",
      company: "Perplexity",
      category: "Research / Search",
      bestFor: "Cited research, current answers, discovery, model switching, and search-first workflows",
      strengths: ["Citations", "Search", "Current info", "Discovery"],
      status: "Active",
      generalUseCases: ["Fast web research with sources", "Fact-checking and current-events answers", "Market and competitor scans", "Document Q&A with model choice", "Comparing answers across model families"],
      submodels: [
        model("Sonar", "Native search", "Perplexity search-first model line for web-grounded answers and cited retrieval.", "Best for fast cited web answers and discovery", "Medium", "Moderate"),
        model("GPT-family option", "Reasoning", "OpenAI-powered option inside Perplexity for stronger reasoning and answer quality.", "Best for deep research and harder analytical questions", "High", "Heavy"),
        model("Claude option", "Writing / coding", "Anthropic-powered option inside Perplexity for precise explanations, coding, and technical research.", "Best for technical research, coding, and careful summaries", "Medium", "Moderate"),
        model("Gemini option", "Alt model", "Google-powered option for alternative reasoning style and multimodal/search-adjacent tasks.", "Best for comparing perspectives and broader model choice", "Medium", "Moderate")
      ]
    },
    {
      name: "Grok",
      company: "xAI",
      category: "Real-time / Social / Media",
      bestFor: "Real-time web/X search, coding, reasoning, voice, images, and video generation",
      strengths: ["Real-time", "Social", "Coding", "Media"],
      status: "Updated",
      generalUseCases: ["Live web and X-aware context", "Coding and technical help", "Real-time search and trend interpretation", "Image and video generation", "Voice and live assistant experiences"],
      submodels: [
        model("Grok 4.3", "Latest main model", "xAI current main model for chat, coding, reasoning, tool use, vision, and real-time search workflows.", "Best for real-time reasoning, coding, and X/web-aware assistance", "Medium", "Moderate"),
        model("Grok Imagine API", "Image / video", "Dedicated xAI media API for image and short video generation workflows.", "Best for visuals, short videos, social media assets, and creative generation", "High", "Heavy"),
        model("Grok Voice API", "Voice", "Voice-focused xAI model/API layer for speech-first assistant experiences.", "Best for voice agents, live chat, and conversational interfaces", "High", "Very heavy")
      ]
    },
    {
      name: "Meta AI / Llama",
      company: "Meta",
      category: "Consumer / Open Models",
      bestFor: "Consumer assistants, open-model workflows, social products, and deployable Llama stacks",
      strengths: ["Open models", "Consumer", "Social", "Deployable"],
      status: "Active",
      generalUseCases: ["Everyday assistant use in Meta products", "Open-model experimentation and deployment", "Social product AI features", "Wearables and hands-free help", "Custom model hosting and fine-tuning"],
      submodels: [
        model("Llama 4 Scout", "Efficient", "Efficient Llama model tier for general assistant tasks and scalable deployment.", "Best for general assistants, integrations, and lower-cost deployments", "Low", "Light"),
        model("Llama 4 Maverick", "Balanced", "More capable Llama model tier for better reasoning, chat quality, and developer experimentation.", "Best for higher-quality open-model chat and analysis", "Medium", "Moderate"),
        model("Llama 4 Behemoth", "Largest", "Largest Llama-family tier for frontier open-model research and high-capability workloads.", "Best for heavyweight open-model experimentation and research", "High", "Heavy")
      ]
    },
    {
      name: "DeepSeek",
      company: "DeepSeek",
      category: "Reasoning / Coding",
      bestFor: "Low-cost reasoning, coding, technical workflows, and budget-conscious AI apps",
      strengths: ["Cheap", "Coding", "Reasoning", "Open weights"],
      status: "Active",
      generalUseCases: ["Code generation and debugging", "Reasoning-heavy prompts", "Budget AI deployments", "Technical assistants", "Developer experimentation"],
      submodels: [
        model("DeepSeek R1", "Reasoning", "Reasoning-focused model optimized for step-by-step thinking, logic, math, and technical tasks.", "Best for math, logic, coding, and deep reasoning", "Low", "Light"),
        model("DeepSeek V3", "Balanced", "General-purpose DeepSeek model for chat, coding, and broad assistant workflows.", "Best for coding, general productivity, and low-cost assistants", "Very low", "Very light")
      ]
    },
    {
      name: "Mistral",
      company: "Mistral AI",
      category: "Open Models / Enterprise",
      bestFor: "Open-weight enterprise models, coding agents, private deployments, and efficient multimodal workflows",
      strengths: ["Open models", "Enterprise", "Coding", "Efficient"],
      status: "Updated",
      generalUseCases: ["Private AI deployments", "Enterprise copilots", "Low-latency assistants", "Multilingual and multimodal work", "Code agents and developer tools"],
      submodels: [
        model("Mistral Large 3", "Flagship open-weight", "Mistral large open-weight flagship multimodal model for reasoning, multilingual work, and enterprise use.", "Best for enterprise reasoning, private deployment, and high-quality open-model output", "Medium", "Moderate"),
        model("Mistral Medium 3.5", "Efficient agentic", "Frontier-class multimodal model optimized for agentic and coding use cases at lower cost.", "Best for agentic workflows, coding, and cost-aware enterprise apps", "Low", "Light"),
        model("Devstral 2", "Code agents", "Mistral code-agent model for solving software engineering tasks and building developer agents.", "Best for autonomous coding agents and repo tasks", "Low", "Light")
      ]
    },
    {
      name: "Qwen",
      company: "Alibaba / Qwen",
      category: "Open Models / Agentic AI",
      bestFor: "Agentic workflows, multilingual tasks, coding, visual agents, and low-cost model deployment",
      strengths: ["Agentic", "Open models", "Multilingual", "Coding"],
      status: "Updated",
      generalUseCases: ["Agentic desktop and mobile workflows", "Coding and technical assistants", "Multilingual applications", "Visual agents and multimodal tasks", "Image generation and editing via Qwen image models"],
      submodels: [
        model("Qwen 3.5", "Agentic", "Qwen model family focused on agentic AI workflows, large workloads, and visual/desktop task execution.", "Best for agentic apps, multilingual assistants, and productivity automation", "Low", "Light"),
        model("Qwen3-Coder-Plus", "Coding", "Coding-focused Qwen model series for developer workflows and programming tasks.", "Best for code generation, debugging, and coding assistants", "Low", "Light"),
        model("Qwen Image 2.0", "Image", "Qwen image model family for image generation and editing workflows.", "Best for visual generation, edits, thumbnails, and creative assets", "Low", "Moderate")
      ]
    },
    {
      name: "Kimi",
      company: "Moonshot AI",
      category: "Agents / Long Context / Coding",
      bestFor: "Long-context work, coding agents, document analysis, websites, and agent swarms",
      strengths: ["Long context", "Coding", "Agents", "Docs"],
      status: "Updated",
      generalUseCases: ["Full-stack website generation", "Document and file analysis", "Long-context research", "Agent swarm workflows", "Coding assistants and codebase tasks"],
      submodels: [
        model("Kimi K2.6", "Latest app model", "Kimi newer app-facing model focused on coding, websites, documents, and agent workflows.", "Best for building websites, analyzing docs, and agent-style workflows", "Medium", "Moderate"),
        model("Kimi K2.5 API", "Long context", "API model promoted for long-context work, tool calling, codebases, and always-on agents.", "Best for long documents, codebases, and API-based agent workflows", "Low", "Light to moderate"),
        model("Kimi Agent Swarm", "Agents", "Multi-agent workflow mode for larger tasks that benefit from parallel specialized agents.", "Best for large projects, research batches, and complex build workflows", "Medium", "Heavy")
      ]
    },
    {
      name: "Cohere",
      company: "Cohere",
      category: "Enterprise / Retrieval",
      bestFor: "Enterprise AI, private deployments, retrieval, search, reranking, and secure business workflows",
      strengths: ["Enterprise", "RAG", "Rerank", "Security"],
      status: "Active",
      generalUseCases: ["Enterprise search and retrieval", "RAG applications", "Secure business assistants", "Document intelligence", "Reranking and classification workflows"],
      submodels: [
        model("Command family", "Enterprise LLM", "Cohere enterprise LLM family for secure business automation, private AI workflows, and assistants.", "Best for enterprise copilots and business process automation", "Medium", "Moderate"),
        model("Embed family", "Embeddings", "Embedding models for turning documents and text into searchable vector representations.", "Best for semantic search, RAG, memory, and knowledge bases", "Low", "Light"),
        model("Rerank family", "Retrieval", "Reranking models that improve search quality by sorting retrieved documents by relevance.", "Best for RAG accuracy, search refinement, and document ranking", "Low", "Light")
      ]
    }
  ];

  const toolCategories = [
    group("Writing / Brainstorming", [
      item("ChatGPT", "Assistant", "Used for writing ads, headlines, brainstorming, and idea generation.", "Copywriting, ideation, content planning"),
      item("Compose.ai", "Email assistant", "Speeds up writing follow-up emails directly inside your inbox.", "Email drafting, reply acceleration, outreach")
    ]),
    group("Video / Media Creation", [
      item("Synthesia", "AI video generator", "Creates presenter-style videos from plain text using avatars.", "Training videos, explainers, sales videos"),
      item("Descript", "Audio + video editor", "Lets you edit audio and video by editing text, with voice cloning features.", "Podcast editing, voice cleanup, repurposing content"),
      item("Video.ai", "Clip repurposing", "Turns long-form videos into short clips for social content.", "Short-form content, reels, highlights")
    ]),
    group("Meetings / Productivity", [
      item("Otter.ai", "Meeting notes", "Automatically records, transcribes, and summarizes meetings.", "Meeting summaries, notes, action items"),
      item("Maxine (NVIDIA)", "Video call enhancement", "Corrects eye contact and improves virtual meeting presence.", "Video calls, conferencing, presentation polish"),
      item("Whisper.ai", "Translation / speech", "Used for fast translation and multilingual speech workflows.", "Translation, subtitles, multilingual content")
    ]),
    group("Agent Infrastructure", [
      item("AgentMail", "AI agent email", "Dedicated email client for agents to send and receive email programmatically.", "Agent workflows, outbound/inbound email, automation"),
      item("QMD", "Memory / retrieval", "Local hybrid search engine for markdown memory using keyword, vector, and reranking.", "Agent memory, markdown retrieval, local knowledge search"),
      item("Agent-Browser", "Web browsing tool", "CLI browser tool for human-like web interaction with fewer tokens.", "Form filling, clicking, browsing, web automation"),
      item("ClawHub", "Skill repository", "Repository for finding and installing community-built skills.", "Skill discovery, tool installation, workflow setup")
    ])
  ];

  const cliMcpCategories = [
    group("CLI Coding Agents", [
      item("OpenAI Codex CLI", "Terminal coding agent", "Local terminal coding agent that can read, change, and run code in a selected directory.", "Repo audits, bug fixes, code generation, terminal-first development"),
      item("Claude Code", "Terminal coding agent", "Agentic coding workflow for reading, editing, testing, and iterating across a codebase.", "Long coding sessions, refactors, repo reasoning, implementation loops"),
      item("Gemini CLI / Code Assist", "Google developer assistant", "Open-source terminal agent with MCP server configuration through settings.", "Google-stack development, code help, cloud-connected workflows"),
      item("Cursor / Windsurf / Continue", "Agent IDE layer", "IDE-native agents for reading projects, editing files, and running workflows close to the code.", "Interactive coding, refactors, local code understanding"),
      item("Aider", "CLI pair programmer", "Git-aware command-line coding assistant for focused file changes and patch workflows.", "Small patches, terminal coding, diff-driven work")
    ]),
    group("MCP Core", [
      item("Model Context Protocol", "Tool connection standard", "A standard way for agents to connect with tools, files, databases, browsers, APIs, and external systems.", "Safe, structured tool and data access"),
      item("MCP Registry", "Discovery layer", "Registry-discovered public MCP servers help agents find vetted connectors and tool integrations.", "Connector discovery, tool setup, ecosystem browsing"),
      item("Filesystem MCP", "Local file connector", "Allows an agent to read, write, and organize files within allowed directories.", "Local projects, document automation, controlled file edits"),
      item("GitHub MCP", "Repository connector", "Lets agents inspect repos, issues, pull requests, commits, and project context.", "Codebase automation, issue triage, PR review"),
      item("Database MCP", "Data connector", "Connects agents to databases like Postgres, SQLite, or other structured systems.", "Analytics dashboards, admin tools, backend inspection"),
      item("Browser / Playwright MCP", "Browser automation", "Lets agents control browsers, click buttons, fill forms, test pages, and inspect UI behavior.", "Frontend QA, web automation, browser control")
    ]),
    group("Agent Extensions", [
      item("Codex Skills / Plugins", "Agent capability layer", "Reusable local skills and plugin bundles that extend what Codex can do in a workspace.", "Specialized workflows, repeatable tooling, repo-specific procedures"),
      item("Claude Agent SDK", "Programmable agents", "SDK angle for agents that can read files, run commands, search the web, edit code, and loop through tasks.", "Custom agent apps, code agents, tool orchestration"),
      item("Gemini CLI MCP servers", "Tool integrations", "MCP server config in Gemini CLI settings lets Gemini use external tools and local connectors.", "CLI agents with tool access"),
      item("LangGraph / LangChain", "Agent framework", "Frameworks for multi-step agents, tool calls, memory flows, and graph-based workflows.", "Production agent apps and workflow logic"),
      item("n8n AI workflows", "Automation builder", "Visual workflow automation connecting AI calls with APIs, databases, email, webhooks, and apps.", "Scheduled tasks and backend automations")
    ]),
    group("Security / Permissions", [
      item("Local file scope", "Boundary", "Limit agents to the folders they actually need and avoid broad machine access.", "Safer file edits and workspace isolation"),
      item("Tool approval", "Control", "Require confirmation for risky shell, browser, database, or external-write operations.", "Preventing unwanted side effects"),
      item("API key handling", "Secret safety", "Keep keys in environment variables or approved secret stores, never in frontend code.", "Credential hygiene"),
      item("Browser permissions", "Session safety", "Treat logged-in browser sessions as high-trust access and scope automation carefully.", "Web automation risk control"),
      item("MCP server trust level", "Connector review", "Only connect trusted MCP servers and review permissions before giving agents tool access.", "Supply-chain and data-access safety")
    ]),
    group("Deployment / DevOps CLI", [
      item("Railway CLI", "Deploy CLI", "Command-line tool for deploying and managing apps, services, env vars, and logs on Railway.", "Backend/frontend deployment and project operations"),
      item("Vercel CLI", "Frontend deploy CLI", "Deploys frontend apps and serverless functions from the terminal.", "React/Next.js deployments and previews"),
      item("GitHub CLI", "Repo operations CLI", "Manages repos, issues, pull requests, auth, and GitHub Actions from the terminal.", "PR workflows, issue management, developer automation")
    ])
  ];

  const costMap = { "Very low": 1, "Low": 2, "Medium": 3, "High": 4, "Subscription / tiered": 3, "Bundled / enterprise": 3, "Enterprise variable": 3 };
  const burnMap = { "Very light": 1, "Light": 2, "Light to moderate": 2.5, "Moderate": 3, "Moderate to heavy": 3.5, "Heavy": 4, "Very heavy": 5, "Opaque": 3, "Variable": 3 };
  const viewModes = ["All", "Platforms", "Tools", "CLI / MCP"];
  const categories = ["All"].concat(Array.from(new Set(ais.map(ai => ai.category))));
  const state = { viewMode: "All", category: "All", query: "", openCards: new Set(), activeModels: {} };
  let rendered = false;

  function model(name, badge, desc, use, cost, burn) {
    return { name, badge, desc, use, cost, burn };
  }

  function group(title, items) {
    return { title, items };
  }

  function item(name, type, note, use) {
    return { name, type, note, use };
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
      const categoryMatch = state.category === "All" || ai.category === state.category;
      const haystack = [
        ai.name,
        ai.company,
        ai.category,
        ai.bestFor,
        ai.status,
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
            <div class="ai-kicker">Agent Office model catalog</div>
            <h1 class="ai-title">Choose the right AI for the job</h1>
            <p class="ai-subtitle">A working catalog for AI brains, product tools, CLI agents, MCP connectors, permissions, deployment, cost tiers, API burn, and practical use cases.</p>
          </div>
          <div class="ai-notice-stack">
            <div class="ai-notice warning">Model names and versions change frequently. Treat these as editable catalog entries and refresh provider data before making buying decisions.</div>
            <div class="ai-notice">Security note: only connect trusted MCP servers; review permissions before giving agents file, browser, database, repo, or API access.</div>
          </div>
        </header>

        <section class="ai-toolbar" aria-label="AI landscape filters">
          <input id="ai-search" class="ai-search" value="${esc(state.query)}" placeholder="Search AIs, sub-models, cost, burn, or use cases" />
          <div class="ai-filter-row">${viewModes.map(mode => pill("view", mode, state.viewMode === mode)).join("")}</div>
          <div class="ai-filter-row" style="grid-column:1 / -1;">${categories.map(cat => pill("category", cat, state.category === cat)).join("")}</div>
        </section>

        ${(state.viewMode === "All" || state.viewMode === "Platforms") ? platformsSection(list) : ""}
        ${(state.viewMode === "All" || state.viewMode === "Tools") ? toolsSection() : ""}
        ${(state.viewMode === "All" || state.viewMode === "CLI / MCP") ? cliSection() : ""}
        ${costSection(list)}
        ${chartSection()}
        ${matrixSection()}
      </div>
    `;
    bindControls(root);
    rendered = true;
  }

  function pill(type, value, active) {
    return `<button class="ai-pill ${active ? "active" : ""}" data-${type}="${esc(value)}" type="button">${esc(value)}</button>`;
  }

  function platformsSection(list) {
    return `
      <section class="ai-section">
        <div class="ai-section-head">
          <div>
            <h2 class="ai-section-title">AI platforms</h2>
            <p class="ai-section-copy">${list.length} platform${list.length === 1 ? "" : "s"} match the current filters.</p>
          </div>
        </div>
        <div class="ai-grid">${list.map(aiCard).join("")}</div>
      </section>
    `;
  }

  function aiCard(ai) {
    const open = state.openCards.has(ai.name);
    const activeName = state.activeModels[ai.name] || ai.submodels[0].name;
    const active = ai.submodels.find(m => m.name === activeName) || ai.submodels[0];
    return `
      <article class="ai-card ${open ? "open" : ""}" data-ai-card="${esc(ai.name)}">
        <button class="ai-card-button" type="button" data-toggle-card="${esc(ai.name)}">
          <div class="ai-card-top">
            <div>
              <div class="ai-company">${esc(ai.company)}</div>
              <div class="ai-name">${esc(ai.name)}</div>
            </div>
            <div class="ai-category">${esc(ai.category)}</div>
          </div>
          <p class="ai-desc">${esc(ai.bestFor)}</p>
          <div class="ai-tags">${ai.strengths.map(tag => `<span class="ai-tag">${esc(tag)}</span>`).join("")}</div>
        </button>
        <div class="ai-card-body">
          <div class="ai-model-tabs">${ai.submodels.map(m => `<button class="ai-pill ${m.name === active.name ? "active" : ""}" data-model-ai="${esc(ai.name)}" data-model-name="${esc(m.name)}" type="button">${esc(m.name)}</button>`).join("")}</div>
          <div class="ai-model-detail">
            <div class="ai-model-title"><span>${esc(active.name)}</span><span>${esc(active.badge)}</span></div>
            <p class="ai-model-copy">${esc(active.desc)}</p>
            <div class="ai-metrics">
              <div class="ai-metric"><span>Token Cost</span><strong>${esc(active.cost)}</strong></div>
              <div class="ai-metric"><span>API Burn</span><strong>${esc(active.burn)}</strong></div>
            </div>
            <p class="ai-model-copy"><strong style="color:#c7d2fe;">Use case:</strong> ${esc(active.use)}</p>
          </div>
          <ul class="ai-use-list">${ai.generalUseCases.map(use => `<li>${esc(use)}</li>`).join("")}</ul>
        </div>
      </article>
    `;
  }

  function toolsSection() {
    return sectionGroups("AI tools by workflow category", "Specialized tools grouped by what they actually do.", toolCategories);
  }

  function cliSection() {
    return sectionGroups("CLI / MCP builder layer", "Agent IDEs, terminal agents, MCP connectors, browser control, memory, deployment, automation, and security boundaries.", cliMcpCategories);
  }

  function sectionGroups(title, copy, groups) {
    return `
      <section class="ai-section">
        <div class="ai-section-head">
          <div>
            <h2 class="ai-section-title">${esc(title)}</h2>
            <p class="ai-section-copy">${esc(copy)}</p>
          </div>
        </div>
        <div class="ai-tool-grid">${groups.map(toolGroup).join("")}</div>
      </section>
    `;
  }

  function toolGroup(group) {
    return `
      <div class="ai-panel ai-tool-group">
        <div class="ai-tool-title">${esc(group.title)}</div>
        ${group.items.map(tool => `
          <div class="ai-tool-item">
            <div class="ai-tool-name">${esc(tool.name)}</div>
            <div class="ai-tool-type">${esc(tool.type)}</div>
            <p class="ai-tool-note">${esc(tool.note)}</p>
            <p class="ai-tool-note"><strong style="color:#c7d2fe;">General use case:</strong> ${esc(tool.use)}</p>
          </div>
        `).join("")}
      </div>
    `;
  }

  function costSection(list) {
    return `
      <section class="ai-section">
        <div class="ai-section-head">
          <div>
            <h2 class="ai-section-title">API cost by AI platform</h2>
            <p class="ai-section-copy">Relative tiers, not exact billing quotes.</p>
          </div>
        </div>
        <div class="ai-grid">
          ${list.map(ai => `
            <div class="ai-panel ai-tool-group">
              <div class="ai-card-top">
                <div>
                  <div class="ai-tool-name">${esc(ai.name)}</div>
                  <div class="ai-tool-type">${esc(ai.company)}</div>
                </div>
                <span class="ai-tag">${esc(ai.status)}</span>
              </div>
              ${ai.submodels.map(m => `
                <div class="ai-tool-item">
                  <div class="ai-tool-name">${esc(m.name)}</div>
                  <div class="ai-tags"><span class="ai-tag">${esc(m.cost)}</span><span class="ai-tag">${esc(m.burn)}</span></div>
                </div>
              `).join("")}
            </div>
          `).join("")}
        </div>
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
            <h2 class="ai-section-title">Cost vs API Burn</h2>
            <p class="ai-section-copy">Each dot is a sub-model. Bottom-left is cheaper and lighter; top-right is expensive and heavy. Filtered by: ${esc(state.category)}</p>
          </div>
        </div>
        <div class="ai-chart" aria-label="Cost versus API burn scatter plot">${dots}</div>
      </section>
    `;
  }

  function matrixSection() {
    const rows = [
      ["Hard reasoning", "ChatGPT / Claude", "Gemini / Grok"],
      ["Coding agent", "Claude / GPT-Codex", "Kimi / Mistral / Qwen"],
      ["Current web research", "Perplexity", "Grok / Gemini"],
      ["Google workflow", "Gemini", "ChatGPT"],
      ["Microsoft work", "Microsoft 365 Copilot", "ChatGPT"],
      ["Low-cost open model", "DeepSeek / Qwen", "Mistral / Llama"],
      ["Enterprise RAG", "Cohere", "Mistral / Microsoft"]
    ];
    return `
      <section class="ai-section ai-panel" style="padding:18px;">
        <h2 class="ai-section-title">Quick recommendation matrix</h2>
        <table class="ai-matrix">
          <thead><tr><th>Need</th><th>Best pick</th><th>Strong alt</th></tr></thead>
          <tbody>${rows.map(row => `<tr><td>${esc(row[0])}</td><td>${esc(row[1])}</td><td>${esc(row[2])}</td></tr>`).join("")}</tbody>
        </table>
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
    root.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => {
      state.viewMode = button.dataset.view;
      render();
    }));
    root.querySelectorAll("[data-category]").forEach(button => button.addEventListener("click", () => {
      state.category = button.dataset.category;
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

  function sectionLabel(section) {
    const label = section.querySelector(".nav-label");
    if (!label) return "Section";
    return label.textContent.replace(/\s*▾\s*$/, "").trim();
  }

  function consolidateSiteMenu() {
    const nav = document.querySelector(".nav");
    if (!nav || nav.querySelector(".site-menu-section")) return;
    addAiNavItem();
    const sections = Array.from(nav.children).filter(el => el.classList && el.classList.contains("nav-section"));
    if (!sections.length) return;
    const unified = document.createElement("div");
    unified.className = "nav-section site-menu-section";
    const label = document.createElement("div");
    label.className = "nav-label";
    label.setAttribute("onclick", "toggleNav(this)");
    label.innerHTML = 'Site Menu <span class="nav-chevron">▾</span>';
    const wrap = document.createElement("div");
    wrap.className = "nav-items-wrap";
    wrap.style.maxHeight = "none";

    sections.forEach(section => {
      const subhead = document.createElement("div");
      subhead.className = "site-menu-subhead";
      subhead.textContent = sectionLabel(section);
      wrap.appendChild(subhead);
      const oldWrap = Array.from(section.children).find(el => el.classList && el.classList.contains("nav-items-wrap"));
      if (oldWrap) Array.from(oldWrap.children).forEach(child => wrap.appendChild(child));
      section.remove();
    });

    unified.appendChild(label);
    unified.appendChild(wrap);
    nav.insertBefore(unified, nav.firstChild);
  }

  function boot() {
    consolidateSiteMenu();
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
