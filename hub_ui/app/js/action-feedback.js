import { toast } from './toast.js';

// Feedback belongs to the presentation; execution stays with the feature API.
export async function runWithFeedback(button, request, message) {
  if (button.disabled) return;
  const original = button.innerHTML;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.classList.add('is-pending');
  try {
    const result = await request();
    if (result?.ok === false || result?.error) throw new Error(result.error || result.message || 'The action could not finish.');
    toast.success(typeof message === 'function' ? message(result) : message);
    return result;
  } catch (error) {
    toast.error(error.message || 'The Hub could not finish that action.');
  } finally {
    button.innerHTML = original;
    button.disabled = button.dataset.available === 'false';
    button.removeAttribute('aria-busy');
    button.classList.remove('is-pending');
  }
}
