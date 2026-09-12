from pathlib import Path
p=Path('CargarDatos.html'); s=p.read_text(encoding='utf-8')
s=s.replace('<script src="js/storage.js"></script>', '<script src="js/storage.js"></script>\n    <script src="js/segment-analysis.js"></script>')
s=s.replace("        function processDataForDB(data, fileName, hotel, type, manualPeriod) {", """        function processDataForDB(data, fileName, hotel, type, manualPeriod) {
            if (type === 'Seg') {
                const report = SegmentAnalysis.parse(data, fileName);
                SegmentAnalysis.merge(db, hotel, report);
                for (const year of Object.keys(report.years)) {
                    const target = db[hotel][year];
                    const coverage = report.years[year].coverage;
                    const months = Object.keys(coverage).map(Number).sort((a, b) => a - b);
                    const first = months[0], last = months[months.length - 1];
                    const label = `${String(coverage[first][0]).padStart(2, '0')}-${String(first + 1).padStart(2, '0')}-${year} al ${String(coverage[last].at(-1)).padStart(2, '0')}-${String(last + 1).padStart(2, '0')}-${year}`;
                    target.updates ||= { prod: 'N/A', seg: 'N/A', otb: 'N/A' };
                    target.updates.seg = label;
                    target.lastSegDate = label;
                }
                return;
            }""")
start=s.index("            } else if (type === 'Seg') {", s.index('function processDataForDB'))
end=s.index("            } else if (type === 'Otb' || type === 'Prevision') {",start)
s=s[:start]+s[end:]
p.write_text(s,encoding='utf-8')
