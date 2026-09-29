"""Feature HTTP adapters composed by server._Handler.

Each mixin uses the handler response/body helpers and owns a disjoint set of
endpoints. They do not start servers and never import hub_ui.server.
"""
