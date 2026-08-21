const LOCALE = "ru-RU";

const pageMode = document.body.dataset.mode;
const rootPath = document.body.dataset.rootPath;
const titleElement = document.getElementById("page-title");
const metaElement = document.getElementById("page-meta");
const contentElement = document.getElementById("programme");
const previousLink = document.getElementById("previous-link");
const nextLink = document.getElementById("next-link");
const todayLink = document.getElementById("today-link");
const printButton = document.getElementById("print-button");

printButton.addEventListener("click", () => window.print());

main().catch((error) => {
  contentElement.innerHTML = "";
  contentElement.append(renderMessage("Не удалось загрузить телепрограмму.", "error"));
  console.error(error);
});

async function main() {
  const [configuredChannelIds, playlistText] = await Promise.all([
    fetchText(`${rootPath}channels.txt`).then(parseChannelIds),
    fetchText(`${rootPath}../alla.m3u`),
  ]);
  const playlist = parsePlaylist(playlistText);
  const channels = selectChannels(playlist.channels, configuredChannelIds);
  const epgText = await fetchText(resolveEpgUrl(playlist.epgUrl));
  const xml = new DOMParser().parseFromString(epgText, "application/xml");
  const programmes = readProgrammes(xml, new Set(channels.map((channel) => channel.id)));
  const selectedDate = getSelectedDate();

  if (pageMode === "week") {
    renderWeek(selectedDate, channels, programmes);
  } else {
    renderDay(selectedDate, channels, programmes);
  }
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }
  return response.text();
}

function parseChannelIds(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

function parsePlaylist(text) {
  const header = text.split(/\r?\n/, 1)[0] || "";
  const epgUrl = readAttribute(header, "url-tvg") || "../epg.xml";
  const channels = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    if (!line.startsWith("#EXTINF:")) {
      continue;
    }

    const id = readAttribute(line, "tvg-id");
    const isRadio = readAttribute(line, "radio") === "true";
    const group = readAttribute(line, "group-title");
    const commaIndex = line.lastIndexOf(",");
    const name = commaIndex >= 0 ? line.slice(commaIndex + 1).trim() : id;

    if (id && !isRadio && group !== "Радио") {
      channels.push({
        id,
        name,
        logo: readAttribute(line, "tvg-logo"),
      });
    }
  }

  return { epgUrl, channels };
}

function readAttribute(text, name) {
  const match = new RegExp(`${name}="([^"]*)"`).exec(text);
  return match ? match[1] : "";
}

function selectChannels(playlistChannels, configuredChannelIds) {
  const playlistById = new Map(playlistChannels.map((channel) => [channel.id, channel]));
  return configuredChannelIds.map((id) => playlistById.get(id)).filter(Boolean);
}

function resolveEpgUrl(url) {
  const currentOrigin = window.location.origin;
  const resolved = new URL(url, new URL("../", window.location.href));

  if (resolved.origin === currentOrigin) {
    return `${rootPath}../${resolved.pathname.split("/").pop()}`;
  }

  return resolved.href;
}

function getSelectedDate() {
  const value = new URLSearchParams(window.location.search).get("date");
  if (/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
    return localDateFromIso(value);
  }
  return startOfLocalDay(new Date());
}

function renderDay(date, channels, programmes) {
  const previousDate = addDays(date, -1);
  const nextDate = addDays(date, 1);
  const isToday = toIsoDate(date) === toIsoDate(new Date());
  const now = new Date();

  document.title = `Телепрограмма - ${formatFullDate(date)}`;
  titleElement.textContent = `Телепрограмма - ${formatFullDate(date)}`;
  metaElement.textContent = `Время показано в часовом поясе браузера: ${getTimeZoneName()}`;
  previousLink.href = `?date=${toIsoDate(previousDate)}`;
  nextLink.href = `?date=${toIsoDate(nextDate)}`;
  todayLink.href = `${rootPath}week/?date=${toIsoDate(date)}`;
  todayLink.textContent = "Неделя";

  contentElement.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.className = "channels";

  for (const channel of channels) {
    const items = programmesForRange(programmes, channel.id, date, addDays(date, 1));
    wrapper.append(renderChannel(channel, items, isToday ? now : null));
  }

  contentElement.append(wrapper);
}

function renderWeek(date, channels, programmes) {
  const monday = startOfWeek(date);
  const sunday = addDays(monday, 6);

  document.title = `Телепрограмма - ${formatDateRange(monday, sunday)}`;
  titleElement.textContent = `Телепрограмма - ${formatDateRange(monday, sunday)}`;
  metaElement.textContent = `Время показано в часовом поясе браузера: ${getTimeZoneName()}`;
  previousLink.href = `?date=${toIsoDate(addDays(monday, -7))}`;
  nextLink.href = `?date=${toIsoDate(addDays(monday, 7))}`;
  todayLink.href = `${rootPath}day/?date=${toIsoDate(new Date())}`;
  todayLink.textContent = "Сегодня";

  contentElement.innerHTML = "";

  for (let index = 0; index < 7; index += 1) {
    const day = addDays(monday, index);
    const section = document.createElement("section");
    section.className = "week-day";

    const heading = document.createElement("h2");
    heading.textContent = formatFullDate(day);
    section.append(heading);

    const wrapper = document.createElement("div");
    wrapper.className = "channels";

    for (const channel of channels) {
      const items = programmesForRange(programmes, channel.id, day, addDays(day, 1));
      wrapper.append(renderChannel(channel, items, null));
    }

    section.append(wrapper);
    contentElement.append(section);
  }
}

function readProgrammes(xml, channelIds) {
  return Array.from(xml.querySelectorAll("programme"))
    .map((node) => ({
      channelId: node.getAttribute("channel"),
      start: parseXmltvDate(node.getAttribute("start")),
      stop: parseXmltvDate(node.getAttribute("stop")),
      title: node.querySelector("title")?.textContent?.trim() || "Без названия",
    }))
    .filter((programme) => channelIds.has(programme.channelId) && programme.start && programme.stop)
    .sort((left, right) => left.start - right.start);
}

function programmesForRange(programmes, channelId, start, end) {
  return programmes.filter((programme) => {
    return programme.channelId === channelId && programme.start < end && programme.stop > start;
  });
}

function renderChannel(channel, items, now) {
  const section = document.createElement("section");
  section.className = "channel";

  const heading = document.createElement("h2");
  heading.className = "channel-title";

  if (channel.logo) {
    const logo = document.createElement("img");
    logo.className = "channel-logo";
    logo.src = channel.logo;
    logo.alt = "";
    logo.loading = "lazy";
    heading.append(logo);
  }

  const name = document.createElement("span");
  name.textContent = channel.name;
  heading.append(name);
  section.append(heading);

  if (items.length === 0) {
    section.append(renderMessage("Нет данных программы.", "empty"));
    return section;
  }

  const list = document.createElement("ul");
  list.className = "programme-list";

  for (const item of items) {
    const row = document.createElement("li");
    row.className = "programme-item";

    if (now && item.stop <= now) {
      row.classList.add("is-past");
    }
    if (now && item.start <= now && item.stop > now) {
      row.classList.add("is-current");
    }

    const time = document.createElement("span");
    time.className = "programme-time";
    time.textContent = formatTime(item.start);

    const title = document.createElement("span");
    title.className = "programme-title";
    title.textContent = item.title;

    row.append(time, title);
    list.append(row);
  }

  section.append(list);
  return section;
}

function renderMessage(message, className) {
  const element = document.createElement("p");
  element.className = className;
  element.textContent = message;
  return element;
}

function parseXmltvDate(value) {
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2}) ([+-])(\d{2})(\d{2})$/.exec(value || "");
  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second, sign, offsetHour, offsetMinute] = match;
  const utc = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second);
  const offset = (+offsetHour * 60 + +offsetMinute) * 60 * 1000;
  return new Date(sign === "+" ? utc - offset : utc + offset);
}

function localDateFromIso(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date) {
  const day = date.getDay() || 7;
  return addDays(startOfLocalDay(date), 1 - day);
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(date) {
  return new Intl.DateTimeFormat(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatFullDate(date) {
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatDateRange(start, end) {
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.getDate()}-${end.getDate()} ${monthName(end)} ${end.getFullYear()}`;
  }
  return `${formatShortDate(start)} - ${formatShortDate(end)}`;
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function monthName(date) {
  return new Intl.DateTimeFormat(LOCALE, {
    month: "long",
  }).format(date);
}

function getTimeZoneName() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "локальное время";
}
