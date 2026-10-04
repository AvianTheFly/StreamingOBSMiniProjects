"""Read-only workflow map, live state, source evidence and paged history."""
from urllib.parse import parse_qs, urlparse


class WorkflowMapRoutes:
    def _get_workflow_map(self, path):
        from hub_ui.workflow_map import catalog, journal
        from hub_ui import settings, project_status
        import events
        query = parse_qs(urlparse(self.path).query)
        try:
            if path == '/api/workflow-map':
                configuration = settings.load_settings()
                self._json(200, catalog.snapshot(projects=project_status.all_statuses(),
                    rules=settings.get_live_rules(), workflows=configuration.get('hub_workflows',[]) or [],
                    hotkeys=configuration.get('hub_hotkeys',{})))
            elif path == '/api/workflow-map/live':
                self._json(200, {**journal.snapshot(), 'subscriptions':events.subscriptions()})
            elif path == '/api/workflow-map/history':
                self._json(200, journal.history(before=query.get('before',[None])[0],
                    since=query.get('since',[0])[0], limit=query.get('limit',[150])[0], query=query.get('q',[''])[0]))
            elif path == '/api/workflow-map/source':
                self._json(200, catalog.source_excerpt(query.get('path',[''])[0], query.get('symbol',[''])[0]))
            else: self._err(404, 'Unknown workflow map view')
        except (ValueError, TypeError) as exc:
            self._err(400, str(exc))
