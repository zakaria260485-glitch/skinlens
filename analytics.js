window.va = window.va || function () {
  (window.vaq = window.vaq || []).push(arguments);
};

window.va('beforeSend', (event) => {
  const url = new URL(event.url);
  url.search = '';
  url.hash = '';
  return { ...event, url: url.toString() };
});
