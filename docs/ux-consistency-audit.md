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

## Sprint 10.5 homepage and typography follow-up

- The duplicate **Ready to use / Available now** homepage block was removed. The homepage now flows from Hero to Tool Categories, Why Secure Tools, Verify Privacy, Open Source, and Footer, with category cards as its single tool-entry model.
- The three retired homepage-only locale keys and all associated DOM and CSS rules were deleted from every catalog and source surface.
- Typography is system-first. Latin languages use `system-ui`, Apple, BlinkMacSystemFont, and Segoe UI fallbacks; Korean adds Apple SD Gothic Neo, Malgun Gothic, and Noto Sans KR; Japanese adds Hiragino Sans, Yu Gothic UI/Yu Gothic, Meiryo, and Noto Sans JP.
- No external font, local webfont, font CDN, `@font-face`, framework, build dependency, or CSP exception was introduced.
- Shared typography tokens now define common size, line-height, letter-spacing, and supported weight steps. Buttons, inputs, selects, and textareas inherit the active locale stack and line height.
- Korean `keep-all` is limited to short editorial UI text. Filenames, metadata, URLs, and technical values retain safe overflow behavior.
- Japanese keeps natural wrapping with strict line-breaking behavior rather than inheriting the Korean policy.
- Header links, category tabs, cards, controls, settings, statuses, Metadata values, and Organizer actions can shrink, wrap, or stack for German and French long copy without arbitrary font reduction.
- Category-tab horizontal scrolling and white PDF preview canvases remain intentional exceptions.

Structural tests cover the category-first homepage, dead-key removal, six-locale parity and placeholders, system font stacks, CJK wrapping scope, long-copy layout invariants, control inheritance, and remote-font absence.

Browser automation remained unavailable because the Windows helper failed under the known sandbox ACL restriction. Automated DOM/CSS checks were strengthened, but human review at 320, 360, 390, 768, 1024, and 1280+ CSS pixels—including German/French at 320 and Korean/Japanese at 360—remains required before v1.0.0.

## Validation boundary

Automated checks cover architecture, semantics, resources, six-language keys, known overflow anti-patterns, CSP, and functional regressions. Browser automation remained subject to the known Windows sandbox ACL limitation during this Sprint. If visual control is unavailable, real human browser review at 360, 390, 768, 1024, and 1440 CSS pixels in Light/Dark themes remains required before v1.0.0 release approval.

## Sprint 16 Privacy hub follow-up

Sprint 16 corrected the Image category list structure and replaced the stale generic Privacy placeholders with two available navigation cards. The hub routes to the existing Image and PDF metadata tools and states their distinct, bounded inspection and cleaning scopes. Scan/OCR and Media remain planned and non-interactive.

Automated checks now enforce:

- one semantic list containing all four Image production cards;
- exactly two available Privacy links with existing route targets;
- all six PDF production links remaining available;
- Scan/OCR and Media remaining planned; and
- complete six-locale Privacy metadata, category, and scope copy.

Interactive browser QA was retried on 2026-08-26 against a temporary localhost server. The browser runtime terminated before navigation with `windows sandbox failed: helper_unknown_error: apply deny-read ACLs`. Browser QA therefore did **not** pass and automated DOM/CSS checks are not presented as visual verification. At that Sprint checkpoint, manual review remained open for `/`, `/tools/image/`, `/tools/privacy/`, `/tools/image/metadata/`, and `/tools/pdf/metadata/` at 320, 360, 390, 768, 1024, and 1440 CSS pixels in Light and Dark themes, including all six locales and keyboard focus/activation of the Privacy cards. The later release-gate disposition is recorded below.


## Sprint 17 release-readiness follow-up

Sprint 17 localized shared brand, primary-navigation, footer-navigation, category-navigation, and local-processing-summary accessible names across all six interface languages. Homepage proof copy now states the bounded invariant—no production file-content upload—rather than the absolute word “Nothing,” and production PDF/Image category notes no longer mention planned cards that are not present. Static i18n and UX tests enforce these contracts across all 19 production pages.

Interactive browser QA was retried on 2026-08-26 against a temporary localhost server. Browser control failed before navigation with `windows sandbox failed: helper_unknown_error: apply deny-read ACLs`. Visual rendering, responsive interaction, keyboard operation, browser-native save/download, and Network-panel checks remain **BLOCKED**, not passed. At that Sprint checkpoint, the manual matrix remained open; its later disposition is recorded in [v2 promotion QA](./v2-release-qa.md).

## Sprint 18 Metadata UX follow-up

Sprint 18 aligned the Image Metadata and PDF Metadata source cards, made decoded values the primary inspection surface, and moved opaque containers, coverage, diagnostics, and complete supported-field views into native details disclosures. Default Privacy Clean remains the primary action; Customize exposes only supported class-level controls and does not offer individual-value editing or broaden either tool’s documented scope. Both cleaners now require their requested verification checks to pass before any output write.

Automated tests cover source reset and object-URL cleanup, decoded/opaque grouping, format-specific Image policies and expectations, PDF default/custom selection, retained-field fail-closed behavior, six-locale parity, responsive CSS contracts, security invariants, and the release gate. `git diff --check` and `node tests/run-all.mjs` passed on 2026-08-26.

Interactive browser QA was attempted against `127.0.0.1:4173`, but the browser-control runtime terminated before navigation with `windows sandbox failed: helper_unknown_error: apply deny-read ACLs`. Visual rendering, keyboard interaction, responsive behavior, native save/download, and Network-panel observations remain **BLOCKED**, not passed. At that Sprint checkpoint, the manual matrix remained open; its later disposition is recorded in [v2 promotion QA](./v2-release-qa.md).

## Metadata Orientation hotfix follow-up

The hotfix upgrades the same-origin Image Metadata runtime to verified secure-metadata v0.1.1. Default JPEG Privacy Clean now preserves one unambiguous valid Orientation value as rendering information while removing other targeted EXIF/GPS data; it still does not decode, rotate, normalize, or re-encode pixels.

Image and PDF Metadata now place source information and primary cleaning controls in a desktop action layout before decoded content in DOM order, then stack them at 54rem and below. Image shows at most six prioritized decoded values and PDF at most four; all supported decoded values and the existing opaque, partial, coverage, diagnostic, and container distinctions remain in native details disclosures.

Real Chrome QA was attempted twice on 2026-08-27 against a temporary localhost server with synthetic Orientation=6 JPEG, PNG, WebP, and PDF fixtures. The Chrome-control runtime failed before connection or navigation with `failed to write kernel assets: The system cannot find the path specified. (os error 3)`. Visual orientation equivalence, interactive layout, keyboard, save, and Network-panel checks remain **BLOCKED**, not passed; temporary fixtures and the server were removed.

Subsequently, the user completed real local manual QA in Chrome 151.0.7922.174 (Official Build, 64-bit). General smoke, Image and Metadata workflows, Light/Dark themes, i18n, responsive layout, keyboard-only interaction, save/cancel/failure behavior, and Network-panel inspection passed. The Network panel showed local/blob behavior only, with no observed file-processing upload request. The user also verified Privacy Clean, Customize/custom cleaning, metadata removal, source/action UX, decoded summary/details, and the corrected Orientation=6 JPEG behavior. The automated browser attempts above remain historically **BLOCKED**; the separate manual Chrome result is **PASS**, and the Orientation blocker is **RESOLVED / PASS**.
