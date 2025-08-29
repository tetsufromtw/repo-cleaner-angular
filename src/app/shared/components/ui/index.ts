// UI Components Library - Wispr Style Design System
// 共用UIコンポーネントのエクスポート

// Button
export { UiButtonComponent, type ButtonVariant, type ButtonSize } from './button/button';

// Card  
export { UiCardComponent } from './card/card';

// Modal
export { UiModalComponent } from './modal/modal';

// Badge
export { UiBadgeComponent, type BadgeVariant, type BadgeSize } from './badge/badge';

// Toast
export { UiToastComponent, type ToastVariant } from './toast/toast';

// Banner
export { UiBannerComponent, type BannerVariant } from './banner/banner';

// Re-import for array
import { UiButtonComponent } from './button/button';
import { UiCardComponent } from './card/card';
import { UiModalComponent } from './modal/modal';
import { UiBadgeComponent } from './badge/badge';
import { UiToastComponent } from './toast/toast';
import { UiBannerComponent } from './banner/banner';

// 一括エクスポート配列（便利用）
export const UI_COMPONENTS = [
  UiButtonComponent,
  UiCardComponent, 
  UiModalComponent,
  UiBadgeComponent,
  UiToastComponent,
  UiBannerComponent
];