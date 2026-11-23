# Dusk & Dawn — Community Hub (GitHub-Migration)

**Status: Staging / Lesemodus** — Die GitHub-Version ist als Unterverzeichnis von `dusk-dawn-voice` angelegt. Das bestehende Voice-Changer-Projekt und die bestehende Apps-Script-Web-App bleiben unverändert erreichbar.

- Vorschau: https://wia204.github.io/dusk-dawn-voice/community-hub/
- Quellcode: https://github.com/wia204/dusk-dawn-voice/tree/main/community-hub
- Backend: `backend/Code.gs` (vollständiger Code, nicht nur ein Ausschnitt)
- Bisherige App: https://script.google.com/macros/s/AKfycbwc1xEltV1MS9TEy9P5CWzSAgBu3x908XDBGHA9jUzA_Uvm_id9M_VU3aLrC5rR7kuYEw/exec
- Google Sheets: bestehende Tabelle (unverändert)

## Struktur

```
community-hub/
  index.html         – komplette Oberfläche aus dem bisherigen Apps Script
  bridge.js          – Browser-Adapter für die Google-Apps-Script-API
  snapshot.json      – vorübergehende Nur-Lese-Kopie der Mitgliederdaten
  backend/
    Code.gs          – vollständige bisherige Web-App mit neuer API
  tests/
    smoke.mjs        – Syntax- und Integrationschecks
```

Die Oberfläche ist nicht neu entwickelt worden. Sie wurde aus der vom Nutzer bereitgestellten **vollständigen v3.3-Quelle** übernommen und enthält das kompakte Static-Layout der v3.4. **Warlokkz und Warlòkkz** bleiben getrennte Charaktere.

## Einmalige Freischaltung der Live-Verbindung

1. Das bestehende Apps-Script-Projekt öffnen, nicht ein neues Projekt anlegen. Vorher eigene Revision sichern.
2. Den vollständigen Inhalt von `community-hub/backend/Code.gs` in das bestehende `Code.gs` übernehmen. Die Datei enthält alle Backendfunktionen, das bisherige Standalone-HTML, den Import und die zusätzliche API.
3. Speichern. Im bestehenden Projekt **Bereitstellen → Bereitstellungen verwalten → Bearbeiten → Neue Version → Bereitstellen** auswählen, sodass der **bestehende /exec-Link gleich bleibt**. Auf den Zugriff und die Ausführung als bisherigen Eigentümer achten.
4. Zuerst über die bisherige Web-App Mitglieder, Statics, Abwesenheiten und Bildausgabe prüfen. In der neuen API zunächst `?api=v1&fn=getHubData&callback=ddhub_cb_test` mit dem bestehenden `/exec`-Link testen: Eine JS-Antwort `ddhub_cb_test(...)` muss erscheinen.
5. Erst nach erfolgreicher Prüfung die GitHub-Datei `bridge.js` auf `const API_ENABLED=true;` umstellen und **Lesen sowie Schreiben** (Static zuweisen/entfernen, Abwesenheit speichern/löschen) im echten Browser testen. Falls iframe-basierte POSTs aufgrund von Google-Sandbox-Richtlinien scheitern, wieder `false` setzen und die bisherige Web-App zum Schreiben verwenden.

**Wichtig:** Nur GitHub-Frontend-Änderungen erscheinen nach Push automatisch. Die automatische Bereitstellung von Apps-Script-Änderungen erfordert zusätzlich ein authentifiziertes `clasp`/GitHub-Actions-Setup. Das ist noch nicht eingerichtet.

## Sicherheit

Die Daten wurden bereits in der bisherigen öffentlichen Web-App gezeigt. Die JSONP-Schnittstelle ist **streng lesend** (`getHubData`, `getHubImage`). Schreibaktionen gehen ausschließlich über POST an die bereits bestehenden Server-Funktionen; derzeit haben sie dieselben Zugriffsbedingungen wie die ursprüngliche öffentlich editierbare Web-App. Für private oder administrativ geschützte Funktionen ist vor einer Freigabe eine zusätzliche echte Authentifizierung erforderlich. Nur eine Origin-Abfrage oder ein im GitHub-Code hinterlegtes Token ist **keine** sichere Schreibberechtigung.

## Ausrollen/Zurückrollen

- GitHub: Änderungen durch Commit; GitHub Pages veröffentlicht den Ordner als statische Seite, sofern die Pages-Einstellungen für `main`/`root` aktiv sind.
- Backend: unverändert weiter nutzbar, bis die API nach erfolgreichem Test freigeschaltet wird.
- Rollback: `API_ENABLED=false` in `bridge.js` und gegebenenfalls frühere Apps-Script-Bereitstellung wiederherstellen.

Ein eigenständiges Repo `dusk-dawn-community-hub` wäre langfristig sauberer. Da die angebundenen GitHub-Aktionen das Erstellen neuer Repositories nicht anbieten, ist die funktionierende Zwischenlösung zunächst ein **isolierter Unterordner**; eine spätere Migration ändert nichts am Datenspeicher.
