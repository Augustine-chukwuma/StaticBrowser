# Static Browser

Static Browser is a lightweight Express.js server that manages incognito Chromium instances using Puppeteer and @sparticuz/chromium-min. It allows you to create, reuse, and destroy headless browser sessions to fetch static HTML content.

## Requirements

- Node.js v18 or higher
- npm

## Installation

```bash
git clone https://github.com/yourusername/static-browser.git
cd static-browser
npm install
````

## Usage

Start the server:

```bash
PORT=3000 node index.js
```

## Endpoints

### `GET /new`

Creates a new incognito browser instance and loads a URL.

**Query Parameters:**

* `id` (optional): Custom ID for the browser instance. If not provided, a UUID will be generated.
* `url` (optional): The target URL to load. Defaults to `https://lite.duckduckgo.com`.

**Response:**

* HTML content of the loaded page
* Header `X-Instance-ID` containing the instance ID

### `GET /load`

Loads the current HTML content of an existing browser instance.

**Query Parameters:**

* `id` (required): ID of the browser instance

**Response:**

* HTML content of the existing instance

### `GET /end`

Closes and deletes an existing browser instance.

**Query Parameters:**

* `id` (required): ID of the browser instance

**Response:**

* Plain text confirmation

### `GET /health`

Checks the status of the browser and the number of active instances.

**Response:**

```json
{
  "status": "OK",
  "instances": 2
}
```

## Architecture

* One Chromium browser instance is launched at startup.
* Each `/new` call creates a new incognito context and page.
* Pages block images, fonts, and stylesheets to reduce resource usage.
* Instances are stored in-memory using `node-cache` and expire after 30 minutes.

## Graceful Shutdown

The app listens for `SIGTERM` and automatically closes the Chromium browser.

## License

MIT

```
```
