# Config snapshots intentionally excluded

Agent Office no longer deploys copies of local OpenClaw workspace files.
Those files may contain private context or credentials and must remain on the
OpenClaw host. The authenticated `/api/config-files` endpoint therefore lists
no agent snapshots unless a separate, private `CONFIG_FILES_DIR` is configured
at runtime.
