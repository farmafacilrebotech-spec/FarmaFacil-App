/**
 * Reexport del kit compartido (archivo canónico: corporate-templates.ts).
 * Conservado para imports estables desde páginas Next.
 */
export {
  FF_EMAIL_BRAND,
  FF_EMAIL_FONT,
  FF_EMAIL_FROM,
  FF_EMAIL_REPLY_TO,
  FF_EMAIL_PHONE_DISPLAY,
  FF_EMAIL_PHONE_TEL,
  FF_LOGO_URL,
  FF_PHOTO_PUBLIC_URL,
  FF_PHOTO_LOCAL_PATH,
  FF_MODULE_ICON_PATHS,
  FF_APP_PUBLIC_ORIGIN,
  escapeHtml,
  normalizeFfPreviewOrigin,
  resolveFfAppAsset,
  resolveFfPhotoUrl,
  applyEmailVars,
  ffEmailHead,
  ffEmailHeaderHtml,
  ffEmailSignatureHtml,
  ffEmailFooterHtml,
  ffModuleCardHtml,
  ffFeatureModulesGridHtml,
  ffCtaButtonHtml,
  ffWrapBody,
  assertSendHtmlHasNoLocalAssets,
  type FfEmailImageMode,
  type FfEmailContent,
  type BuildFfEmailOptions,
} from './corporate-templates';
