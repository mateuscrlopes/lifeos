import { icon, hasIcon, iconNames } from './icons.js';
import { toast } from './toast.js';
import { confirmAction } from './confirm.js';
import { openModalElement, closeModalElement, closeTopModal } from './modal.js';

window.LifeOSUI = Object.freeze({
  icon,
  hasIcon,
  iconNames,
  toast,
  confirm: confirmAction,
  modal: Object.freeze({
    open: openModalElement,
    close: closeModalElement,
    closeTop: closeTopModal,
  }),
});

window.dispatchEvent(new CustomEvent('lifeos:ui-ready'));
