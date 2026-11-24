"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOpenApiDocument = void 0;
const getRouteLayers = (app) => {
    const router = app._router;
    return router?.stack ?? [];
};
const toOpenApiPath = (path) => path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
const getTag = (path) => {
    const segment = path.split("/").filter(Boolean)[1] ?? "root";
    return segment.charAt(0).toUpperCase() + segment.slice(1);
};
const getOperationId = (method, path) => `${method}_${path.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
const getPathParameters = (path) => {
    const names = [...path.matchAll(/:([A-Za-z0-9_]+)/g)].map((match) => match[1]);
    if (names.length === 0) {
        return undefined;
    }
    return names.map((name) => ({
        name,
        in: "path",
        required: true,
        schema: { type: "string" },
    }));
};
const createOperation = (method, path, handlers) => {
    const protectedRoute = handlers.some(({ handle }) => handle.name === "verifyToken");
    const operation = {
        tags: [getTag(path)],
        operationId: getOperationId(method, path),
        summary: `${method.toUpperCase()} ${path}`,
        responses: {
            "200": { description: "Request completed successfully" },
            "400": { description: "Invalid request" },
            "401": { description: "Authentication required or invalid" },
            "500": { description: "Internal server error" },
        },
        parameters: getPathParameters(path),
    };
    if (method !== "get" && method !== "delete") {
        operation.requestBody = {
            required: false,
            content: {
                "application/json": {
                    schema: { type: "object", additionalProperties: true },
                },
            },
        };
    }
    if (protectedRoute) {
        operation.security = [{ bearerAuth: [] }];
    }
    return operation;
};
const createOpenApiDocument = (app) => {
    const paths = {};
    for (const layer of getRouteLayers(app)) {
        if (!layer.route) {
            continue;
        }
        const path = toOpenApiPath(layer.route.path);
        paths[path] ?? (paths[path] = {});
        for (const method of Object.keys(layer.route.methods)) {
            if (method === "_all") {
                continue;
            }
            paths[path][method] = createOperation(method, layer.route.path, layer.route.stack);
        }
    }
    return {
        openapi: "3.0.3",
        info: {
            title: "Oxford EMUP API",
            version: "1.0.0",
            description: "Interactive API documentation for the Oxford EMUP school server.",
        },
        servers: [
            {
                url: process.env.API_BASE_URL ?? "http://localhost:3000",
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
            },
        },
        paths,
    };
};
exports.createOpenApiDocument = createOpenApiDocument;
