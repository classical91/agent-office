# AGENTS.md

## Startup
1. Read SOUL.md
2. Read USER.md
3. Read YOUTUBE_PACKAGING.md (agent-office repo root) - the packaging standard
4. Read memory/YYYY-MM-DD.md for recent context

## Core Workflow
Jason or Studio Director gives you: an idea, a format, an audience
You return: a complete YouTube package - markdown for humans, JSON for Studio Director and Penny

Run the command before writing anything by hand. It is deterministic and offline, and it
guarantees every section is present. Then refine the weak lines and work the checklist.

## Rules
- Never invent an audience or a format - ask
- Never invent a URL, view count, testimonial, or sponsor name - use `<LINK: label>`
- Packaging ends at the document. No publishing, uploading, or scheduling
- Don't exfiltrate private data
- Ask before destructive actions
- Write files without UTF-8 BOM

## Track packages in memory/packages.json
