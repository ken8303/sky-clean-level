# Sky Clean Level

A small weather website that shows the current sky clean level, the next 24 hours, and the next three nights of hourly sky clarity.

Sky clean level is calculated from cloud cover:

```text
100% = clear sky
0% = fully clouded sky
```

The app uses browser location permission when available, plus manual city search as a fallback.

## Run Locally

Start a local server in this folder:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```
