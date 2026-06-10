/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

export class nsBharatResearchReportBuilder {
  static build(query, findings, sources) {
    let report = `# Research Report: ${query}\n\n`;
    report += `Generated on ${new Date().toLocaleDateString()}\n\n`;
    
    report += `## Executive Summary\n`;
    report += `Comprehensive research analysis on ${query} based on ${sources.length} verified sources.\n\n`;
    
    report += `## Key Findings\n`;
    findings.forEach(finding => {
      report += `### ${finding.title}\n${finding.content}\n\n`;
    });
    
    report += `## References\n`;
    sources.forEach(source => {
      report += `[${source.id}] **${source.title}** - [Link](${source.url})\n`;
    });
    
    return report;
  }
}
