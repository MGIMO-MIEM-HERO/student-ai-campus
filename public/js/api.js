export async function api(path, body) {
  const response = await fetch('/api/' + path, body === undefined ? {} : {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body),
  });
  let result;
  try { result = await response.json(); } catch { throw Object.assign(new Error('Не удалось получить ответ сервера. Повторите попытку.'), {status: response.status}); }
  if (!response.ok) throw Object.assign(new Error(result.error || 'Ошибка запроса.'), {status: response.status});
  return result;
}
