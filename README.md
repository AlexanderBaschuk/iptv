# IPTV playlist

Личный M3U-плейлист для мамы, который можно опубликовать через GitHub Pages и открыть на Smart TV.

## Устройство и приложение

- Телевизор: TCL с Google TV.
- IPTV-приложение: Televizo.

Для переключения каналов цифровыми кнопками в Premium-версии Televizo нужно включить нумерацию: `Настройки` → `Доп. настройки` → `Номера видео`. Televizo назначает номера сверху вниз по порядку каналов, поэтому после изменения плейлиста они могут сдвигаться.

## Файлы

- `alla.m3u` - основной плейлист для IPTV-приложения.
- `tv/` - веб-страницы телепрограммы на день и неделю.
- `logos/` - папка для логотипов каналов.
- `index.html` - простая страница GitHub Pages со ссылкой на плейлист.
- `.nojekyll` - отключает Jekyll, чтобы GitHub Pages отдавал файлы как есть.

## URL плейлиста

После публикации через GitHub Pages плейлист будет доступен по адресу:

```text
https://alexanderbaschuk.github.io/iptv/alla.m3u
```

## Телепрограмма

```text
https://alexanderbaschuk.github.io/iptv/tv/day/
https://alexanderbaschuk.github.io/iptv/tv/week/
```

## Полезные ссылки

https://github.com/iptv-org
