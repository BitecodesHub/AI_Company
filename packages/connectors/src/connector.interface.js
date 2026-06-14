"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectorRegistry = exports.ConnectorRegistry = void 0;
/** Registry of all registered connectors */
class ConnectorRegistry {
    connectors = new Map();
    register(connector) {
        this.connectors.set(connector.type, connector);
    }
    get(type) {
        return this.connectors.get(type);
    }
    list() {
        return Array.from(this.connectors.values());
    }
    getAction(connectorType, actionName) {
        return this.connectors.get(connectorType)?.actions[actionName];
    }
}
exports.ConnectorRegistry = ConnectorRegistry;
exports.connectorRegistry = new ConnectorRegistry();
//# sourceMappingURL=connector.interface.js.map