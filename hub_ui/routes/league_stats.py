"""Thin HTTP adapter for League Stats' public API; match state stays in its feature."""
import json
from urllib.parse import parse_qs, urlparse
from lib import twitch_chat


class LeagueStatsRoutes:
    def _get_league_stats(self,path):
        from league_stats import api
        params = parse_qs(urlparse(self.path).query)
        filters = {key:params[key][0] for key in ('account','period','champion','queue','session_id') if key in params}
        try:
            data = api.state(**filters)
            if path=='/api/league-stats':
                data['chat'] = twitch_chat.status()
                self._json(200,data)
            elif path=='/api/league-stats/export':
                # Export every filtered record, not just the 50 shown in the UI.
                data = api.export(**filters)
                payload = json.dumps(data,ensure_ascii=False).encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type','application/json; charset=utf-8')
                self.send_header('Content-Disposition','attachment; filename="league-stats.json"')
                self.send_header('Content-Length',str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
            else:
                self._err(404,'Unknown tracker endpoint')
        except (ValueError,OSError) as exc:
            self._err(400,str(exc))

    def _post_league_stats(self,path):
        from league_stats import api
        body = self._body()
        try:
            result = api.save(body) if path=='/api/league-stats/settings' else api.action(path.rsplit('/',1)[-1],body)
            self._json(200,result)
        except (ValueError,OSError) as exc:
            self._err(400,str(exc))
