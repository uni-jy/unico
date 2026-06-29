# Security Policy

## Supported Versions

The `main` branch receives security fixes.

## Reporting a Vulnerability

Please do not open a public issue for vulnerabilities that may expose:

- NetEase Cloud Music cookies
- API keys
- `.env` contents
- playlist dumps or listener portraits
- generated private audio files

Report privately to the repository owner through GitHub security advisories when available. If advisories are not enabled, contact the maintainer directly and include:

- A short description of the issue
- Steps to reproduce
- Impact and affected files
- Whether any credential or user data may have been exposed

## Handling Sensitive Data

Unico ignores `.env`, `data/`, and `cache/` by default. If you fork or deploy the project, keep those paths out of public repositories and backups that are not meant to hold private data.
