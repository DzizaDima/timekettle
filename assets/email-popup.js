const EMAIL_POPUP_SUBSCRIBED_KEY = 'tk_email_popup_subscribed';
const EMAIL_POPUP_SNOOZE_UNTIL_KEY = 'tk_email_popup_snooze_until';
const EMAIL_POPUP_AWAITING_RELOAD_KEY = 'tk_email_popup_awaiting_reload';

class EmailPopup extends HTMLElement {
  constructor() {
    super();
    this.dialog = this.querySelector('.email-popup__dialog');
    this.form = this.querySelector('form');
    this.formSubmitStatus = this.querySelector('[data-email-popup-form-state]');
    this.emailInput = this.querySelector('input[type="email"]');
    this.formState = this.querySelector('[data-email-popup-state="form"]');
    this.successState = this.querySelector('[data-email-popup-state="success"]');

    this.querySelectorAll('[data-email-popup-close]').forEach((element) => {
      element.addEventListener('click', () => this.close());
    });

    this.addEventListener('keydown', (event) => {
      if (event.code === 'Escape') this.close();
    });

    if (this.form) {
      this.form.addEventListener('submit', () => this.setStorage(EMAIL_POPUP_AWAITING_RELOAD_KEY, '1'));
    }

    this.init();
  }

  getStorage(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  setStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      /* localStorage unavailable (private mode, blocked) — popup just won't remember state */
    }
  }

  removeStorage(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      /* noop */
    }
  }

  init() {
    const awaitingReload = this.getStorage(EMAIL_POPUP_AWAITING_RELOAD_KEY) === '1';

    if (awaitingReload && this.formSubmitStatus) {
      this.removeStorage(EMAIL_POPUP_AWAITING_RELOAD_KEY);

      if (this.formSubmitStatus.dataset.postedSuccessfully === 'true') {
        this.setStorage(EMAIL_POPUP_SUBSCRIBED_KEY, '1');
        this.showSuccessState();
        this.open();
        return;
      }

      if (this.formSubmitStatus.dataset.hasErrors === 'true') {
        this.open();
        return;
      }
    }

    if (this.getStorage(EMAIL_POPUP_SUBSCRIBED_KEY) === '1') return;

    const snoozeUntil = Number(this.getStorage(EMAIL_POPUP_SNOOZE_UNTIL_KEY));
    if (snoozeUntil && Date.now() < snoozeUntil) return;

    this.scheduleTrigger();
  }

  scheduleTrigger() {
    const delaySeconds = Number(this.dataset.delaySeconds) || 0;
    const triggerOnInteraction = this.dataset.triggerInteraction === 'true';
    let triggered = false;

    const trigger = () => {
      if (triggered) return;
      triggered = true;
      clearTimeout(timer);
      interactionEvents.forEach((eventName) => document.removeEventListener(eventName, trigger));
      this.open();
    };

    const timer = setTimeout(trigger, delaySeconds * 1000);

    const interactionEvents = ['scroll', 'click', 'keydown', 'touchstart', 'mousemove'];
    if (triggerOnInteraction) {
      interactionEvents.forEach((eventName) =>
        document.addEventListener(eventName, trigger, { once: true, passive: true })
      );
    }
  }

  showSuccessState() {
    if (!this.formState || !this.successState) return;
    this.formState.hidden = true;
    this.successState.hidden = false;
  }

  open() {
    this.classList.add('email-popup--open');
    document.body.classList.add('overflow-hidden');
    this.openedBy = document.activeElement;

    const focusTarget = this.successState && !this.successState.hidden ? this.dialog : this.emailInput || this.dialog;
    window.trapFocus(this, focusTarget);
  }

  close() {
    if (!this.classList.contains('email-popup--open')) return;
    this.classList.remove('email-popup--open');
    document.body.classList.remove('overflow-hidden');
    window.removeTrapFocus(this.openedBy);

    if (this.getStorage(EMAIL_POPUP_SUBSCRIBED_KEY) !== '1') {
      const days = Number(this.dataset.reshowDays) || 7;
      this.setStorage(EMAIL_POPUP_SNOOZE_UNTIL_KEY, String(Date.now() + days * 24 * 60 * 60 * 1000));
    }
  }
}

customElements.define('email-popup', EmailPopup);
