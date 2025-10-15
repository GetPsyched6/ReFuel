# Changelog

## [1.1.0] - 2025-10-16

### Changed

- **Watsonx Integration**: Replaced SDK with direct REST API for better control
- **Model Updated**: Now using `meta-llama/llama-3-3-70b-instruct` instead of Granite
- **Token Management**: Automatic IAM token refresh with 24-hour expiry handling
- **JSON Parsing**: Aggressive JSON parsing with multiple fallback strategies
  - Markdown code block extraction
  - Escaped JSON handling
  - Text-based fallback parsing
  - Trailing comma removal
- **Dependencies**: Removed heavy SDK dependencies (pandas, numpy, ibm-watsonx-ai, etc.)
- **Charts**: Added line and bar charts for all comparison view modes

### Added

- Comparison charts (line + bar) for normalized, overlap, and complete views
- Token expiry management with auto-refresh
- Comprehensive JSON parsing fallbacks for LLM responses

### Improved

- Reduced backend dependencies from 30+ to ~20 packages
- Faster installation and lighter footprint
- More reliable AI responses with aggressive prompt engineering

### Fixed

- LLM JSON generation issues with Llama model
- Token expiration handling

## [1.0.0] - 2025-10-15

### Added

- Initial release
- Selenium-based scraping for UPS, FedEx, DHL
- FastAPI REST API
- React frontend with glassmorphism UI
- 3 comparison view modes
- Historical trends visualization
- AI insights and chatbot
- MCP server for agent integration
