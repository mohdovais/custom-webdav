import { eventHandler, getRequestURL, H3, serve } from "h3";
import { basename } from "node:path";

const NOT_FOUND = "Not Found";
const SHORTCUT_FILENAME = "new_deal_site.url";
const NOTE_FILENAME = "THIS_DEAL_SITE_HAS_BEEN_MOVED_TO_NEW_LOCATION.txt";

function equalsIgnoringCase(a: string, b: string) {
    return a.localeCompare(b, undefined, { sensitivity: "base" }) === 0;
}

// Helper to generate the WebDAV XML response
const createWebDavXML = (responses: string[]) => {
    return `
<?xml version="1.0" encoding="utf-8" ?>
<D:multistatus xmlns:D="DAV:">
${responses.join("\n")}
</D:multistatus>`.trim();
};

const createResponseNode = (
    href: string,
    isCollection: boolean,
    contentLength: number = 0,
) => {
    return `
<D:response>
  <D:href>${href}</D:href>
  <D:propstat>
    <D:prop>
      <D:resourcetype>${isCollection ? "<D:collection/>" : ""}</D:resourcetype>
      <D:getcontentlength>${contentLength}</D:getcontentlength>
      <D:getlastmodified>${new Date().toUTCString()}</D:getlastmodified>
    </D:prop>
    <D:status>HTTP/1.1 200 OK</D:status>
  </D:propstat>
</D:response>`.trim();
};

const app = new H3().use(eventHandler(async (event) => {
    const method = event.req.method;
    const url = getRequestURL(event);

    // Regex to match /deal/sitecollection/{id}/ and optional filename
    const match = url.pathname.match(/^\/deal\/\d+\/(\d+)\/?(.*)?$/);

    if (!match) {
        event.res.status = 404;
        event.res.statusText = NOT_FOUND;
        return NOT_FOUND;
    }

    const dealId = match[1];
    const fileName = match[2] ? basename(match[2]) : "";

    // Common WebDAV Headers
    event.res.headers.set("DAV", "1, 2");
    event.res.headers.set("Allow", "OPTIONS, PROPFIND, GET, HEAD");

    // 1. Handle OPTIONS
    if (method === "OPTIONS") {
        return null;
    }

    // 2. Handle GET (File Content OR Directory Listing)
    if (method === "GET") {
        if (equalsIgnoringCase(fileName, SHORTCUT_FILENAME)) {
            event.res.headers.set("Content-Type", "application/x.mswinurl");
            return `[InternetShortcut]
URL=http://www.example.com/redirect/${dealId}
`;
        }

        if (equalsIgnoringCase(fileName, NOTE_FILENAME)) {
            event.res.headers.set("Content-Type", "text/plain");
            return `Lorem ipsum dolor sit amet, consectetur adipiscing elit. In nec nisi laoreet, hendrerit augue vitae, malesuada ex. 
            
Duis imperdiet urna nec bibendum elementum. Sed vulputate nunc at mi varius, sed sagittis odio porttitor. Etiam sodales luctus diam, eu vulputate nulla tincidunt et. Nam faucibus sapien et aliquet finibus. Quisque vel erat eget nulla scelerisque varius vitae non dui. Donec consectetur commodo viverra. Pellentesque egestas nulla iaculis suscipit vehicula. Suspendisse condimentum est ut ipsum porta dignissim. Aenean cursus pharetra leo. Proin et blandit ipsum.
            
http://example.com/redirect/${dealId}
`;
        }

        // Directory Listing
        if (!fileName.includes(".")) {
            event.res.headers.set("Content-Type", "text/html");
            return `<html>
  <head><title>Index of ${url.pathname}</title></head>
  <body>
    <h1>Index of ${url.pathname}</h1>
    <hr>
    <ul>
      <li><a href="${NOTE_FILENAME}">${NOTE_FILENAME}</a></li>
      <li><a href="${SHORTCUT_FILENAME}">${SHORTCUT_FILENAME}</a></li>
    </ul>
    <hr>
  </body>
</html>
`;
        }

        // Unknown file
        event.res.status = 404;
        event.res.statusText = NOT_FOUND;
        return NOT_FOUND;
    }

    // 3. Handle PROPFIND (WebDAV Machine Listing)
    if (method === "PROPFIND") {
        event.res.headers.set("Content-Type", "application/xml; charset=utf-8");
        event.res.status = 207;

        const baseUrl = `/${
            url.pathname.split("/").filter(Boolean).join("/")
        }/`;

        if (!fileName.includes(".")) {
            const folderNode = createResponseNode(baseUrl, true);
            const file1Node = createResponseNode(
                baseUrl + NOTE_FILENAME,
                false,
                100,
            );
            const file2Node = createResponseNode(
                baseUrl + SHORTCUT_FILENAME,
                false,
                50,
            );

            return createWebDavXML([folderNode, file1Node, file2Node]);
        }

        if (fileName === NOTE_FILENAME) {
            return createWebDavXML([
                createResponseNode(baseUrl + NOTE_FILENAME, false, 50),
            ]);
        }
        if (fileName === SHORTCUT_FILENAME) {
            return createWebDavXML([
                createResponseNode(baseUrl + SHORTCUT_FILENAME, false, 100),
            ]);
        }

        event.res.status = 404;
        event.res.statusText = NOT_FOUND;
        return;
    }

    event.res.status = 405;
    event.res.statusText = "Method Not Allowed";
    return "Method Not Allowed";
}));

serve(app, { port: 3000 });
