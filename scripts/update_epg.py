#!/usr/bin/env python3

import gzip
import os
import sys
import tempfile
import time
import urllib.request
import xml.etree.ElementTree as ET


SOURCE_URL = "https://iptv-epg.org/files/epg-ru.xml.gz"
CHANNEL_IDS = {
    "ПервыйканалHD.ru": "ChannelOne.ru@HD",
    "Россия1HD.ru": "Russia1.ru@HD",
    "ТВЦ.ru": "TVCentr.ru@SD",
    "НТВ.ru": "NTV.ru@HD",
    "РоссияК.ru": "RussiaK.ru@HD",
    "Пятница.ru": "Friday.ru@SD",
    "Звезда.ru": "Zvezda.ru@HD",
    "РБК‑ТВ.ru": "RBKTV.ru@SD",
}


def open_source():
    request = urllib.request.Request(
        SOURCE_URL,
        headers={"User-Agent": "AlexanderBaschuk/iptv EPG updater"},
    )
    error = None

    for attempt in range(3):
        try:
            return urllib.request.urlopen(request, timeout=120)
        except OSError as exc:
            error = exc
            if attempt < 2:
                time.sleep(2**attempt)

    raise RuntimeError(f"failed to download {SOURCE_URL}") from error


def build_epg():
    with open_source() as response, gzip.GzipFile(fileobj=response) as source:
        events = ET.iterparse(source, events=("start", "end"))
        _, source_root = next(events)
        output_root = ET.Element("tv", source_root.attrib)
        channel_ids = set()
        programme_ids = set()

        for event, element in events:
            if event != "end":
                continue

            if element.tag == "channel":
                target_id = CHANNEL_IDS.get(element.attrib.get("id"))
                if target_id:
                    element.set("id", target_id)
                    element.tail = None
                    output_root.append(element)
                    channel_ids.add(target_id)
                else:
                    element.clear()
            elif element.tag == "programme":
                target_id = CHANNEL_IDS.get(element.attrib.get("channel"))
                if target_id:
                    element.set("channel", target_id)
                    element.tail = None
                    output_root.append(element)
                    programme_ids.add(target_id)
                else:
                    element.clear()

    expected_ids = set(CHANNEL_IDS.values())
    missing_channels = expected_ids - channel_ids
    missing_programmes = expected_ids - programme_ids

    if missing_channels:
        raise RuntimeError(
            f"source is missing channels: {', '.join(sorted(missing_channels))}"
        )
    if missing_programmes:
        raise RuntimeError(
            f"source is missing programmes: {', '.join(sorted(missing_programmes))}"
        )

    ET.indent(output_root, space="  ")
    return ET.ElementTree(output_root)


def main():
    tree = build_epg()
    output_path = "epg.xml"
    output_directory = os.path.dirname(os.path.abspath(output_path))

    with tempfile.NamedTemporaryFile(
        dir=output_directory,
        prefix=".epg.",
        suffix=".xml.tmp",
        delete=False,
    ) as output:
        temporary_path = output.name

    tree.write(temporary_path, encoding="utf-8", xml_declaration=True)
    os.replace(temporary_path, output_path)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        sys.exit(str(exc))
