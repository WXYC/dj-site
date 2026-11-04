# References

The published guidance behind the rules. Each rule in this design system was checked against these sources when it was written down. Use them to settle a question the docs don't answer; prefer the house rule where the two differ.

## Variants, color, tokens
- Joy UI, global variants — https://v7.mui.com/joy-ui/main-features/global-variants/ (`solid` for the most important action; the rest by context)
- Joy UI, theme colors — https://v7.mui.com/joy-ui/customization/theme-colors/ and themed components — https://v7.mui.com/joy-ui/customization/themed-components/ (custom palette names give up global variants; why the slots are reused as hues)
- W3C Design Tokens Format Module 2025.10 — https://www.designtokens.org/tr/2025.10/format/ (alias tokens for semantic relationships)
- GitHub Primer, color — https://primer.style/foundations/color/overview · Adobe Spectrum, design tokens — https://spectrum.adobe.com/page/design-tokens/ · Atlassian, color — https://atlassian.design/foundations/color (components consume semantic tokens, never base values)
- WCAG 2.2: Use of Color — https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html · Contrast (Minimum) — https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html · Non-text Contrast — https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- Material Components, dark theme — https://raw.githubusercontent.com/material-components/material-components-android/master/docs/theming/Dark.md (dark grey, lighter at elevation, weak shadows)
- GOV.UK Design System, button — https://design-system.service.gov.uk/components/button/ · Atlassian, button — https://atlassian.design/components/button/examples · IBM Carbon, button — https://carbondesignsystem.com/components/button/usage/ (restraint with destructive styling; label destructive actions)

## Typography, density, layout
- IBM Carbon, data table — https://carbondesignsystem.com/components/data-table/usage/ (row sizes; overflow actions visible on touch)
- GitHub Primer, DataTable — https://primer.style/product/components/data-table/ (row actions in the last column; right-align numbers)
- IBM Carbon, typography — https://carbondesignsystem.com/elements/typography/overview/ (productive vs expressive sets)
- Matthew Butterick, *Practical Typography* — https://practicaltypography.com/summary-of-key-rules.html, https://practicaltypography.com/alternate-figures.html, https://practicaltypography.com/monospaced-fonts.html
- MDN, `font-variant-numeric` — https://developer.mozilla.org/en-US/docs/Web/CSS/font-variant-numeric
- Nielsen Norman Group: data tables — https://www.nngroup.com/articles/data-tables/ · mobile tables — https://www.nngroup.com/articles/mobile-tables/ · cards — https://www.nngroup.com/articles/cards-component/ · list thumbnails — https://www.nngroup.com/articles/mobile-list-thumbnail/
- Edward Tufte, smallest effective difference — https://www.edwardtufte.com/notebook/sparkline-theory-and-practice-edward-tufte/

## Interaction and states
- NN/g: contextual menus — https://www.nngroup.com/articles/contextual-menus-guidelines/ · flexibility and efficiency — https://www.nngroup.com/articles/flexibility-efficiency-heuristic/ · flat design and signifiers — https://www.nngroup.com/articles/flat-design/
- Apple HIG, context menus — https://developer.apple.com/design/human-interface-guidelines/context-menus (items also in the main UI; destructive last)
- MDN, `hover` / `any-hover` media features — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/hover
- WCAG 2.2: Keyboard — https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html · Content on Hover or Focus — https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html · Status Messages — https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html · Animation from Interactions — https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
- WAI-ARIA APG, tooltip — https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/ · MDN, `title` attribute — https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/title · MDN, `status` role — https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/status_role · MDN, `aria-busy` — https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-busy
- NN/g: response times — https://www.nngroup.com/articles/response-times-3-important-limits/ · skeleton screens — https://www.nngroup.com/articles/skeleton-screens/ · confirmation dialogs — https://www.nngroup.com/articles/confirmation-dialog/ · error messages — https://www.nngroup.com/articles/error-message-guidelines/ · empty states — https://www.nngroup.com/articles/empty-state-interface-design/ · animation duration — https://www.nngroup.com/articles/animation-duration/
- MDN, `prefers-reduced-motion` — https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion

## Voice
- Mailchimp Content Style Guide, voice and tone — https://styleguide.mailchimp.com/voice-and-tone/
- NN/g, the four dimensions of tone of voice — https://www.nngroup.com/articles/tone-of-voice-dimensions/

## The library model
- Library of Congress, "The Anatomy of a Call Number" — https://blogs.loc.gov/maps/2025/11/anatomy-of-a-call-number/ (a call number is a unique shelf address)
- CSU Stanislaus Library, ANSCR call numbers — https://library.csustan.edu/music/anscr (genre-first filing for sound recordings)
- NN/g, skeuomorphism — https://www.nngroup.com/articles/skeuomorphism/ (metaphor earns its keep through function, not texture)
