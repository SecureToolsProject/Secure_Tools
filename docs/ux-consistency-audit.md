# UX consistency audit

Sprint 10 audited the homepage, About, Privacy, all five category hubs, the PDF hub, and the six production file tools at source level. The review covered file input, source and empty states, queues, settings, actions, progress, errors, results, save behavior, privacy messaging, shared chrome, responsive behavior, themes, and accessibility.

## Inventory and resolutions

| Pattern | Pages/tools | Finding | Resolution |
| --- | --- | --- | --- |
| Shared tool foundation | All six file tools | Common styles were owned by Images to PDF; PDF to Images also imported Split CSS. | Moved file input, source, queue, mode, form, action, progress, and status rules to `tools/shared/tool.css`; removed sibling stylesheet dependencies. |
| File input | All six file tools | The interaction was already a full-area native label with keyboard focus and drag/drop, but the image accept filter existed only at runtime. | Preserved the shared semantic pattern and added the supported image formats to static markup. Busy inputs now expose the same disabled visual treatment as their actual state. |
| Privacy note | All six file tools | Placement and localization were already consistent. | Preserved exactly one local-processing note beside each drop zone. |
| Empty state | Images to PDF, Merge PDF | Queue copy repeated ordering instructions already present near the input. | Shortened empty copy in all six languages. `[hidden]` remains explicitly protected in shared CSS. |
| Source summary | Split, PDF to Images, Organizer, Metadata | Split and PDF to Images shared a full source card; Organizer and Metadata use toolbar summaries suited to larger workspaces. | Consolidated the full source card and added an explicit compact source-state variant for the two complex workspaces. |
| Queue/list | Images to PDF, Merge PDF | Both used the same visual grammar under an image-specific list class name. | Renamed the shared presentation class to `file-list`; item content remains tool-specific. |
| Settings | Images to PDF, Merge, Split, PDF to Images | Labels, controls, help, checks, and sidebars were already structurally shared, but some selectors were duplicated. | Consolidated field/mode rules and retained each tool's necessary controls. |
| Primary actions | All six file tools | Shared sizing existed, but disabled buttons still reacted to hover. | Standardized pointer, hover, disabled color, border, background, and cursor behavior. |
| Secondary/destructive actions | Queues, Organizer, Metadata | Remove actions were restrained and context-specific; disabled icon/page actions relied mainly on opacity. | Preserved restrained destructive hover/color treatment and gave disabled actions explicit theme-aware colors. |
| Loading/progress | All six file tools | Progress and live status were colocated with actions, but status feedback appeared as unstructured text. | Kept existing progress semantics and converted non-empty status messages to one bordered, theme-aware neutral/error/warning/success pattern. |
| Error state | All six file tools | Errors used localized text and live regions without alerts or unsafe HTML, but visual treatment varied by tone. | Standardized error, warning, and success tokens and panels; field-level errors retain `role="alert"`. |
| Result/save | Organizer, Metadata, other production tools | Organizer and Metadata duplicated the same output grid. Other tools intentionally save immediately through the shared picker/download fallback. | Added a shared responsive `tool-output` pattern for Organizer and Metadata; retained immediate saving elsewhere. |
| Header | All production pages | Header structure was consistent; some category-page brand links lacked the established accessible name. | Applied the same home-link name throughout; preserved the shared navigation and language/theme controls. |
| Footer | Tool and category pages | Link sets differed, and planned category hubs omitted footer navigation. | Standardized order to Tools, Privacy, About, Source on all production pages. |
| Category hubs | PDF, Image, Privacy, Scan/OCR, Media | Available and planned semantics were correct, but planned-card title alignment differed. | Kept available tools as links and planned tools as non-interactive articles; aligned their status/title rhythm. |
| Light/Dark | Organizer and tool states | The thumbnail surround used one light hardcoded backdrop; warning/success state ownership was inconsistent. | Added theme tokens for the non-document preview surround and centralized tool feedback colors. PDF canvas white remains intentionally unchanged. |
| Responsive/i18n | All production pages and six locales | Sprint 9 foundations were sound; shared output/source rules had drifted across sibling stylesheets. | Preserved language-specific line breaking, shrinkable flex/grid children, wrapping buttons, stacked outputs, mobile metadata rows, and header control wrapping. |
| Reduced motion | Shared and tool-specific transitions | Existing protection was complete. | Preserved the global reduced-motion override and tool-specific transition removals. |

## Accessibility checklist

- [x] Skip links and main targets are present on every production page.
- [x] Full-area file labels activate native inputs by pointer and keyboard.
- [x] File inputs have descriptions and accepted-type declarations.
- [x] Drag-active, focus-visible, disabled, and busy/loading affordances remain explicit.
- [x] Every production tool exposes a polite live status region.
- [x] Real progress elements retain localized accessible names.
- [x] Queue and page icon controls retain localized names and keyboard equivalents.
- [x] Form labels, help references, field alerts, radio legends, and metadata checkboxes remain associated.
- [x] No browser `alert()` or unsafe translated HTML sink was introduced.
- [x] Header/footer landmarks and brand links are consistent.

## Intentional exceptions

- Organizer keeps a page grid because queue rows cannot represent page previews, rotation, and page-level actions clearly.
- Metadata keeps a responsive semantic table on wider screens and structured rows on narrow screens.
- Split and PDF to Images use full source cards; Organizer and Metadata use compact summaries inside their existing workspaces.
- The PDF preview canvas stays white because it represents document content, while only its surrounding backdrop follows the theme.
- PDF to Images allows safe source replacement by cancelling the active conversion first; other tools disable source replacement while busy.
- Tools continue to save through the established picker/download fallback. A separate “Ready to save” panel would add a second action without improving the existing flow.
- Category navigation may scroll horizontally on very narrow screens by design; the page body itself must not overflow.

## Validation boundary

Automated checks cover architecture, semantics, resources, six-language keys, known overflow anti-patterns, CSP, and functional regressions. Browser automation remained subject to the known Windows sandbox ACL limitation during this Sprint. If visual control is unavailable, real human browser review at 360, 390, 768, 1024, and 1440 CSS pixels in Light/Dark themes remains required before v1.0.0 release approval.
