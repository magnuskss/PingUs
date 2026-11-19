# Changelog

All notable changes to PingUs are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-11-18

First public release.

### Added
- Overview dashboard with live status, IP/gateway/DNS info and a health score.
- Live Ping with latency, jitter, packet loss and a live chart.
- Animated traceroute with per-hop latency.
- DNS analyzer (A, AAAA, MX, TXT, NS, CNAME, SOA, PTR and reverse lookups).
- Speed test (download, upload, ping, jitter).
- Local network device discovery (IP, MAC, hostname).
- TCP port scanner with optional Nmap service detection.
- Wi-Fi analyzer (signal, channels, nearby networks).
- Packet analyzer using TShark.
- Device monitor with uptime tracking and offline detection.
- Passive OSINT search for domains and IPs.
- Scan history with JSON/CSV export. Uses SQLite, with a JSON fallback.
- Windows NSIS installer (x64).
