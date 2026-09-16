"""Builds the QMSR Gap Assessment Workbook.

Element list is transcribed from Compliance Program 7382.850, Attachment A
(Tables of QMS Areas, OAFRs, Elements, and Requirements), implementation date
2 February 2026. Model 2 minimum elements are from Figure 2 of the same program.
'Top-cited area' flags reflect FDA officials' public ranking of Form 483
observation areas for February to mid-April 2026 (risk management; outsourcing
and purchasing; complaint handling and feedback; UDI; corrective action).
"""
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

NAVY = "0F2A4A"; GOLD = "A8730F"; TINT = "EAF0F6"; TINT2 = "F5F8FB"
YELLOW = "FFF9E0"; LINE = "CBD2D9"; GREY = "5A6B7B"
FONT = "Arial"

thin = Side(style="thin", color=LINE)
BOX = Border(left=thin, right=thin, top=thin, bottom=thin)

def style_header(ws, row, ncols, height=42):
    ws.row_dimensions[row].height = height
    for c in range(1, ncols + 1):
        cell = ws.cell(row=row, column=c)
        cell.font = Font(name=FONT, bold=True, color="FFFFFF", size=9)
        cell.fill = PatternFill("solid", fgColor=NAVY)
        cell.alignment = Alignment(wrap_text=True, vertical="center")
        cell.border = BOX

def title_block(ws, title, subtitle, ncols):
    ws["A1"] = title
    ws["A1"].font = Font(name=FONT, bold=True, size=14, color=NAVY)
    ws["A2"] = subtitle
    ws["A2"].font = Font(name=FONT, size=9, italic=True, color=GREY)
    ws.row_dimensions[1].height = 20

def widths(ws, spec):
    for col, w in spec.items():
        ws.column_dimensions[col].width = w

wb = Workbook()

# =====================================================================
# Sheet 1: Read me
# =====================================================================
ws = wb.active
ws.title = "Read me"
widths(ws, {"A": 32, "B": 104})
title_block(ws, "QMSR Gap Assessment Workbook", "Companion to the seminar 'QMSR Transition: a strategic roadmap for shifting from FDA Part 820 to the Quality Management System Regulation'", 2)
rows = [
    ("", ""),
    ("Purpose", "An evidence-based gap assessment against the Quality Management System Regulation (21 CFR Part 820, effective 2 February 2026) and the inspection process FDA uses to assess it, Compliance Program 7382.850."),
    ("Why it is built this way", "The compliance program tests whether a process works, not whether a procedure exists. So the decisive column is 'What the evidence lacked', not 'procedure updated'. Rows are prioritised by inspection exposure rather than by clause order."),
    ("", ""),
    ("How to use it", "1. On 'Gap assessment', set 'Applicable to us' for every row. Document any exclusion and its justification (for example Clause 7.3 under 21 CFR 820.10(c))."),
    ("", "2. For each applicable row, name the current procedure or record, then SAMPLE A RECORD. Write what you sampled and what it lacked."),
    ("", "3. Set 'Regulatory gap', 'Exposure' and 'Effort'. The 'Suggested exposure' column is a starting point, not an answer."),
    ("", "4. Work the rows in priority-rank order. Assign an owner, a due date and a verification method."),
    ("", "5. Review the 'Dashboard' with top management and record the decisions in management review."),
    ("", ""),
    ("Cells to fill in", "Every cell with a pale yellow fill is an input. Columns A to H and every unshaded column carry reference data or formulas: do not overwrite them."),
    ("Formula columns", "'Suggested exposure', 'Priority score' and 'Priority rank' on 'Gap assessment'; every figure on 'Dashboard'; the 'Status' column on 'Metrics'. These recalculate from your inputs."),
    ("", ""),
    ("Priority score", "Exposure contributes 30 (High), 20 (Medium) or 10 (Low). A regulatory gap adds 5. Effort adds 3 (S), 2 (M) or 1 (L), so that among equal-exposure rows the cheaper fix ranks first. Change the weights in the formula if your risk appetite differs."),
    ("Suggested exposure", "High where the element is in Compliance Program 7382.850 Model 2's minimum list, or in an area FDA officials ranked among the top Form 483 observation areas in early 2026. Medium otherwise. Override it with your own judgement."),
    ("", ""),
    ("Sheets", "Read me · Gap assessment (58 elements) · Dashboard · Model 2 minimum · 820.35 and 820.45 checklists · Crosswalk · Metrics · Roadmap"),
    ("", ""),
    ("Sources", "Element list, Model 2 minimum list and inspection types: Compliance Program 7382.850, Inspection of Medical Device Manufacturers, implementation date 2 February 2026, Attachment A and Figures 1 to 3."),
    ("", "Regulatory text: 21 CFR Part 820 as in force from 2 February 2026; final rule 89 FR 7496 (2 February 2024); correction 89 FR 82945 (15 October 2024); technical amendments 90 FR 55978 (4 December 2025)."),
    ("", "Top-cited observation areas: FDA officials' public remarks, February to June 2026 (risk management; outsourcing and purchasing; complaint handling and feedback; UDI; corrective action)."),
    ("", "The crosswalk is industry-authored. FDA declined to publish a mapping of the QS regulation to the QMSR (final rule, Comment 18); the only official mapping is the subpart-level Table 1 in the 2022 proposed rule, 87 FR 10119 at 10124."),
    ("", ""),
    ("Verify before you rely on it", "Content was verified in September 2026. Regulations, FDA web pages and the compliance program change. Confirm against the primary sources before using this workbook as evidence."),
    ("Prepared by", "Elder Consulting, LLC. Seminar material; not legal or regulatory advice."),
]
r = 3
for k, v in rows:
    ws.cell(row=r, column=1, value=k).font = Font(name=FONT, bold=True, size=10, color=NAVY)
    c = ws.cell(row=r, column=2, value=v)
    c.font = Font(name=FONT, size=10)
    c.alignment = Alignment(wrap_text=True, vertical="top")
    ws.row_dimensions[r].height = 13 if not v else max(13, 13 * (1 + len(v) // 110))
    r += 1

# example row
r += 1
ws.cell(row=r, column=1, value="Example of a completed row").font = Font(name=FONT, bold=True, size=11, color=GOLD)
r += 1
ex_hdr = ["Element", "Applicable", "Current procedure / record", "Evidence sampled", "What the evidence lacked", "Reg. gap", "Exposure", "Effort", "Owner", "Due", "Verification method", "Status"]
ex_val = ["Complaint Handling (MA&I)", "Y", "QP-822 rev 8; complaint form F-822-01 rev 3",
          "20 complaint records closed Jan-Jun 2026, sampled from the eQMS log",
          "6 of 20 carry no UDI or other device identification (820.35(a)(3)); 4 of 20 carry no documented Part 803 reportability decision or rationale",
          "Y", "High", "S", "Complaints Manager", "2026-10-31",
          "Re-audit 20 records closed after the form revision; 100% carry UDI and a documented reportability decision", "In progress"]
for i, (h, v) in enumerate(zip(ex_hdr, ex_val)):
    ws.cell(row=r + i, column=1, value=h).font = Font(name=FONT, size=9, bold=True)
    c = ws.cell(row=r + i, column=2, value=v)
    c.font = Font(name=FONT, size=9, color="0000FF")
    c.fill = PatternFill("solid", fgColor=YELLOW)
    c.alignment = Alignment(wrap_text=True, vertical="top")
    c.border = BOX
ws.freeze_panes = "A3"

# =====================================================================
# Sheet 2: Gap assessment
# =====================================================================
# (area, element, iso, qmsr, qsr, model2, topcited)
E = [
 ("Management Oversight","Quality Management System","4.1.1, 4.1.2, 4.1.3, 4.1.4","820.10(a)","820.5, 820.20","N","N"),
 ("Management Oversight","Risk-based Approach","4.1.2 b)","820.10(a)","(no direct predecessor)","N","Y"),
 ("Management Oversight","QMS Software Validation","4.1.6","820.10(a)","820.70(i)","N","N"),
 ("Management Oversight","Quality Manual","4.2.2","820.10(a)","820.20(e), 820.186","N","N"),
 ("Management Oversight","Medical Device File","4.2.3","820.10(a)","820.181 (DMR)","Y","N"),
 ("Management Oversight","Control of Documents and Records","4.2.1, 4.2.4, 4.2.5","820.35, 820.45","820.40, 820.180","N","N"),
 ("Management Oversight","Management Commitment","5.1","—","820.20(a)","N","N"),
 ("Management Oversight","Customer Focus","5.2","—","(no direct predecessor)","N","N"),
 ("Management Oversight","Quality Policy, Quality Objectives, QMS Planning","5.3, 5.4.1, 5.4.2","—","820.20(a), 820.20(d)","N","N"),
 ("Management Oversight","Responsibility, Authority, and Communication","5.5.1, 5.5.2, 5.5.3","—","820.20(b)","N","N"),
 ("Management Oversight","Management Review","5.6.1, 5.6.2, 5.6.3","—","820.20(c)","Y","N"),
 ("Management Oversight","Provision of Resources","6.1","—","820.20(b)(1)","N","N"),
 ("Management Oversight","Human Resources","6.2","—","820.25","N","N"),
 ("Management Oversight","Planning of Product Realization","7.1","—","820.30(g) (risk analysis)","Y","Y"),
 ("Design and Development","Customer Related Processes","7.2.1, 7.2.2, 7.2.3","820.10(b)(4)","820.30(c)","N","N"),
 ("Design and Development","Design and Development General","7.3.1","820.10(c)","820.30(a)","N","N"),
 ("Design and Development","Design and Development Planning","7.3.2","820.10(c)","820.30(b)","N","N"),
 ("Design and Development","Design and Development Inputs","7.3.3","820.10(c)","820.30(c)","Y","N"),
 ("Design and Development","Design and Development Outputs","7.3.4","820.10(c)","820.30(d)","Y","N"),
 ("Design and Development","Design and Development Review","7.3.5","820.10(c)","820.30(e)","Y","N"),
 ("Design and Development","Design and Development Verification","7.3.6","820.10(c)","820.30(f)","Y","N"),
 ("Design and Development","Design and Development Software Validation","7.3.7","820.10(c)","820.30(g)","Y","N"),
 ("Design and Development","Design and Development Validation","7.3.7","820.10(c)","820.30(g)","Y","N"),
 ("Design and Development","Design and Development Transfer","7.3.8","820.10(c)","820.30(h)","Y","N"),
 ("Design and Development","Control of Design and Development Changes","7.3.9","820.10(c)","820.30(i)","N","N"),
 ("Design and Development","Design and Development Files","7.3.10","820.10(c)","820.30(j) (DHF)","N","N"),
 ("Production and Service Provision","Infrastructure and Maintenance","6.3","—","820.70(f), 820.70(g)","N","N"),
 ("Production and Service Provision","Work Environment and Contamination Control","6.4.1, 6.4.2","—","820.70(c), 820.70(d), 820.70(e)","N","N"),
 ("Production and Service Provision","Control of Production and Service Provision","7.5.1","820.35, 820.45","820.70(a), 820.120, 820.130","Y","N"),
 ("Production and Service Provision","Cleanliness of Product","7.5.2","—","820.70(h)","N","N"),
 ("Production and Service Provision","Installation and Servicing Activities","7.5.3, 7.5.4","820.35","820.170, 820.200","N","N"),
 ("Production and Service Provision","Validation of Processes for Production and Service Provision","7.5.6","—","820.75","Y","N"),
 ("Production and Service Provision","Sterile Medical Devices and Validation of Processes for Sterilization and Sterile Barrier Systems","7.5.5, 7.5.7","—","820.75 (general)","Y (sterile product only)","N"),
 ("Production and Service Provision","Identification and Traceability","7.5.8, 7.5.9.1, 7.5.9.2","820.10(b)(1), 820.10(b)(2), 820.10(d), 820.35, 820.45","820.60, 820.65, 820.86","Y","N"),
 ("Production and Service Provision","Customer Property","7.5.10","—","(no direct predecessor)","N","N"),
 ("Production and Service Provision","Preservation of Product","7.5.11","—","820.140, 820.150, 820.160","N","N"),
 ("Production and Service Provision","Control of Monitoring and Measuring Equipment","7.6","—","820.72","N","N"),
 ("Measurement, Analysis, and Improvement","Measurement, Analysis, and Improvement - General","8.1, 8.5.1","—","820.100(a)","N","N"),
 ("Measurement, Analysis, and Improvement","Feedback","8.2.1","—","820.198(a)","Y","Y"),
 ("Measurement, Analysis, and Improvement","Complaint Handling","8.2.2, 8.2.3","820.10(b)(3), 820.10(b)(4), 820.35","820.198","Y","Y"),
 ("Measurement, Analysis, and Improvement","Internal Audits","8.2.4","—","820.22","Y","N"),
 ("Measurement, Analysis, and Improvement","Monitoring and Measurement of Processes","8.2.5","—","820.70(a), 820.75(b)","N","N"),
 ("Measurement, Analysis, and Improvement","Monitoring and Measurement of Product","8.2.6","—","820.80, 820.86","N","N"),
 ("Measurement, Analysis, and Improvement","Control of Nonconforming Product","8.3.1, 8.3.2, 8.3.3, 8.3.4","820.10(b)(4), 820.3(b) rework","820.90","Y","N"),
 ("Measurement, Analysis, and Improvement","Analysis of Data","8.4","—","820.250","Y","N"),
 ("Measurement, Analysis, and Improvement","Corrective Action","8.5.2","—","820.100","Y","Y"),
 ("Measurement, Analysis, and Improvement","Preventive Action","8.5.3","—","820.100","Y","N"),
 ("Outsourcing and Purchasing","Outsourcing","4.1.5","—","820.50","Y","Y"),
 ("Outsourcing and Purchasing","Purchasing Process","7.4.1","—","820.50(a)","N","Y"),
 ("Outsourcing and Purchasing","Purchasing Information and Purchased Product","7.4.2, 7.4.3","—","820.50(b), 820.80(b)","N","Y"),
 ("Change Control","QMS Changes","4.1.4, 4.2.4, 4.2.5, 5.4.2, 5.6.1, 5.6.2, 5.6.3, 8.5.1","—","820.40, 820.20(d)","N","N"),
 ("Change Control","Software Changes","4.1.6, 7.5.6, 7.6","—","820.70(i)","N","N"),
 ("Change Control","Product and Process Changes","4.1.4, 7.2.2, 7.3.9, 7.3.10, 7.5.6, 7.5.7","—","820.30(i), 820.70(b), 820.75(c)","Y","N"),
 ("Change Control","Purchasing Changes","7.4.2, 7.4.3","—","820.50(b)","N","N"),
 ("OAFR","Medical Device Reporting","8.2.3","21 CFR 803; 820.10(b)(3)","820.198(a)(3)","Y (both models, except PMA preapproval)","N"),
 ("OAFR","Reports of Corrections and Removals","8.3.3","21 CFR 806; 820.10(b)(4)","820.100","Y (both models, except PMA preapproval)","N"),
 ("OAFR","Medical Device Tracking Requirements","7.5.9.1","21 CFR 821; 820.10(b)(2)","820.65","Y (both models, where a tracking order was issued; except PMA preapproval)","N"),
 ("OAFR","Unique Device Identification","7.5.8","21 CFR 830; 820.45; 820.10(b)(1)","820.60, 820.120","Y (both models, except PMA preapproval)","Y"),
]
assert len(E) == 58, len(E)

ws = wb.create_sheet("Gap assessment")
hdr = ["ID", "QMS Area", "Element (CP 7382.850)", "ISO 13485:2016 clause(s)", "QMSR section(s)",
       "Former QSR section(s)", "Model 2 minimum", "Top-cited area 2026",
       "Applicable to us (Y/N)", "Current procedure / record", "Evidence sampled (what, how many)",
       "What the evidence lacked", "Regulatory gap (Y/N)", "Suggested exposure",
       "Exposure (High/Medium/Low)", "Effort (S/M/L)", "Priority score", "Priority rank",
       "Owner", "Due date", "Verification method", "Status"]
ws.cell(row=1, column=1, value="QMSR Gap Assessment: elements of Compliance Program 7382.850").font = Font(name=FONT, bold=True, size=13, color=NAVY)
ws.cell(row=2, column=1, value="Pale yellow columns are inputs. Priority score and rank are formulas. Sample a record for every applicable row; 'What the evidence lacked' is the column that decides the assessment.").font = Font(name=FONT, size=9, italic=True, color=GREY)
for i, h in enumerate(hdr, start=1):
    ws.cell(row=3, column=i, value=h)
style_header(ws, 3, len(hdr), height=46)
widths(ws, {"A": 7, "B": 22, "C": 34, "D": 22, "E": 24, "F": 22, "G": 11, "H": 11, "I": 11,
            "J": 26, "K": 30, "L": 34, "M": 11, "N": 12, "O": 13, "P": 10, "Q": 10, "R": 9,
            "T": 11, "S": 16, "U": 30, "V": 13})
INPUT_COLS = [9, 10, 11, 12, 13, 15, 16, 19, 20, 21, 22]
first, last = 4, 3 + len(E)
for j, (area, el, iso, qmsr, qsr, m2, tc) in enumerate(E):
    r = first + j
    vals = [f"E-{j+1:02d}", area, el, iso, qmsr, qsr, m2, tc, "Y", "", "", "", "",
            None, "", "", None, None, "", "", "", ""]
    for i, v in enumerate(vals, start=1):
        c = ws.cell(row=r, column=i, value=v)
        c.font = Font(name=FONT, size=9, color="0000FF" if i in INPUT_COLS else "000000")
        c.alignment = Alignment(wrap_text=True, vertical="top")
        c.border = BOX
        if i in INPUT_COLS:
            c.fill = PatternFill("solid", fgColor=YELLOW)
        elif i <= 8:
            c.fill = PatternFill("solid", fgColor=TINT2 if j % 2 == 0 else "FFFFFF")
    # Suggested exposure
    ws.cell(row=r, column=14).value = f'=IF(OR(LEFT($G{r},1)="Y",$H{r}="Y"),"High","Medium")'
    # Priority score
    ws.cell(row=r, column=17).value = (
        f'=IF($O{r}="","",IF($O{r}="High",30,IF($O{r}="Medium",20,IF($O{r}="Low",10,0)))'
        f'+IF($M{r}="Y",5,0)'
        f'+IF($P{r}="S",3,IF($P{r}="M",2,IF($P{r}="L",1,0))))')
    # Priority rank
    ws.cell(row=r, column=18).value = f'=IF($Q{r}="","",RANK($Q{r},$Q${first}:$Q${last},0))'
    ws.row_dimensions[r].height = 30
ws.freeze_panes = "D4"
ws.auto_filter.ref = f"A3:V{last}"

dvs = [
    (DataValidation(type="list", formula1='"Y,N"', allow_blank=True), ["I", "M"]),
    (DataValidation(type="list", formula1='"High,Medium,Low"', allow_blank=True), ["O"]),
    (DataValidation(type="list", formula1='"S,M,L"', allow_blank=True), ["P"]),
    (DataValidation(type="list", formula1='"Not started,In progress,Closed,Not applicable"', allow_blank=True), ["V"]),
]
for dv, cols in dvs:
    ws.add_data_validation(dv)
    for col in cols:
        dv.add(f"{col}{first}:{col}{last}")

# =====================================================================
# Sheet 3: Dashboard
# =====================================================================
ws = wb.create_sheet("Dashboard")
widths(ws, {"A": 42, "B": 14, "C": 14, "D": 14, "E": 14, "F": 14, "G": 14})
ws.cell(row=1, column=1, value="Dashboard").font = Font(name=FONT, bold=True, size=13, color=NAVY)
ws.cell(row=2, column=1, value="Every figure is a formula over 'Gap assessment'. Take the top block to management review.").font = Font(name=FONT, size=9, italic=True, color=GREY)
G = "'Gap assessment'!"
def put(r, c, v, bold=False, size=10, fill=None, num=None):
    cell = ws.cell(row=r, column=c, value=v)
    cell.font = Font(name=FONT, size=size, bold=bold)
    cell.alignment = Alignment(wrap_text=True, vertical="center")
    if fill: cell.fill = PatternFill("solid", fgColor=fill)
    if num: cell.number_format = num
    cell.border = BOX
    return cell

r = 4
put(r, 1, "Headline readiness", bold=True, size=11, fill=TINT)
put(r, 2, "Count", bold=True, size=11, fill=TINT)
head = [
    ("Elements in the assessment", f'=COUNTA({G}$A$4:$A$61)'),
    ("Elements marked applicable", f'=COUNTIF({G}$I$4:$I$61,"Y")'),
    ("Elements with evidence sampled", f'=COUNTIFS({G}$I$4:$I$61,"Y",{G}$K$4:$K$61,"<>")'),
    ("Applicable elements NOT yet sampled", f'=COUNTIF({G}$I$4:$I$61,"Y")-COUNTIFS({G}$I$4:$I$61,"Y",{G}$K$4:$K$61,"<>")'),
    ("Regulatory gaps identified", f'=COUNTIFS({G}$I$4:$I$61,"Y",{G}$M$4:$M$61,"Y")'),
    ("Inspection-critical gaps (gap = Y and exposure = High)", f'=COUNTIFS({G}$I$4:$I$61,"Y",{G}$M$4:$M$61,"Y",{G}$O$4:$O$61,"High")'),
    ("Inspection-critical gaps still open (not Closed)", f'=COUNTIFS({G}$I$4:$I$61,"Y",{G}$M$4:$M$61,"Y",{G}$O$4:$O$61,"High",{G}$V$4:$V$61,"<>Closed")'),
    ("Gaps with no owner assigned", f'=COUNTIFS({G}$I$4:$I$61,"Y",{G}$M$4:$M$61,"Y",{G}$S$4:$S$61,"")'),
    ("Gaps closed", f'=COUNTIFS({G}$I$4:$I$61,"Y",{G}$M$4:$M$61,"Y",{G}$V$4:$V$61,"Closed")'),
]
for i, (label, f) in enumerate(head, start=1):
    put(r + i, 1, label)
    put(r + i, 2, f, num="0")
r = r + len(head) + 3

put(r, 1, "By QMS Area", bold=True, size=11, fill=TINT)
for i, h in enumerate(["Elements", "Applicable", "Sampled", "Gaps", "High-exposure gaps", "Closed"], start=2):
    put(r, i, h, bold=True, size=9, fill=TINT)
areas = ["Management Oversight", "Design and Development", "Production and Service Provision",
         "Measurement, Analysis, and Improvement", "Outsourcing and Purchasing", "Change Control", "OAFR"]
for i, a in enumerate(areas, start=1):
    rr = r + i
    put(rr, 1, a)
    put(rr, 2, f'=COUNTIF({G}$B$4:$B$61,$A{rr})', num="0")
    put(rr, 3, f'=COUNTIFS({G}$B$4:$B$61,$A{rr},{G}$I$4:$I$61,"Y")', num="0")
    put(rr, 4, f'=COUNTIFS({G}$B$4:$B$61,$A{rr},{G}$I$4:$I$61,"Y",{G}$K$4:$K$61,"<>")', num="0")
    put(rr, 5, f'=COUNTIFS({G}$B$4:$B$61,$A{rr},{G}$I$4:$I$61,"Y",{G}$M$4:$M$61,"Y")', num="0")
    put(rr, 6, f'=COUNTIFS({G}$B$4:$B$61,$A{rr},{G}$I$4:$I$61,"Y",{G}$M$4:$M$61,"Y",{G}$O$4:$O$61,"High")', num="0")
    put(rr, 7, f'=COUNTIFS({G}$B$4:$B$61,$A{rr},{G}$M$4:$M$61,"Y",{G}$V$4:$V$61,"Closed")', num="0")
rr = r + len(areas) + 1
put(rr, 1, "Total", bold=True, fill=TINT2)
for c in range(2, 8):
    L = get_column_letter(c)
    put(rr, c, f'=SUM({L}{r+1}:{L}{rr-1})', bold=True, fill=TINT2, num="0")
r = rr + 3

put(r, 1, "Status of applicable elements", bold=True, size=11, fill=TINT)
put(r, 2, "Count", bold=True, size=11, fill=TINT)
for i, st in enumerate(["Not started", "In progress", "Closed", "Not applicable", "(blank)"], start=1):
    put(r + i, 1, st)
    if st == "(blank)":
        put(r + i, 2, f'=COUNTIFS({G}$I$4:$I$61,"Y",{G}$V$4:$V$61,"")', num="0")
    else:
        put(r + i, 2, f'=COUNTIFS({G}$I$4:$I$61,"Y",{G}$V$4:$V$61,$A{r+i})', num="0")
r = r + 7
put(r, 1, "Exit criterion for the Assess phase", bold=True, size=11, fill=YELLOW)
put(r, 2, "Met?", bold=True, size=11, fill=YELLOW)
put(r + 1, 1, "Every applicable element sampled with at least one record")
put(r + 1, 2, '=IF(B8=0,"Yes","No - " & B8 & " left to sample")')
put(r + 2, 1, "No inspection-critical gap left open")
put(r + 2, 2, '=IF(B11=0,"Yes","No - " & B11 & " open")')
put(r + 3, 1, "Every gap has a named owner")
put(r + 3, 2, '=IF(B12=0,"Yes","No - " & B12 & " unassigned")')
ws.freeze_panes = "A4"

# =====================================================================
# Sheet 4: Model 2 minimum
# =====================================================================
ws = wb.create_sheet("Model 2 minimum")
widths(ws, {"A": 34, "B": 44, "C": 60})
ws.cell(row=1, column=1, value="Compliance Program 7382.850, Figure 2: Inspection Model 2 minimum elements").font = Font(name=FONT, bold=True, size=13, color=NAVY)
ws.cell(row=2, column=1, value="Model 2 applies to baseline surveillance inspections (no FDA inspection or MDSAP audit history, or risk factors indicating a need) and to PMA preapproval inspections. 22 QMS Area elements, or 23 where the product is sterile. Model 1, used for every other inspection type, requires at least one element from each of the six QMS Areas plus the four OAFRs as applicable. Neither list is a ceiling: both figures instruct the investigator to consider additional elements where the inspection reveals objectionable conditions or the minimum coverage is not enough to assess something, and Figure 3 assigns most inspection types their model 'unless otherwise specified by the assignment'.").font = Font(name=FONT, size=9, italic=True, color=GREY)
ws.row_dimensions[2].height = 82
ws.cell(row=2, column=1).alignment = Alignment(wrap_text=True, vertical="top")
ws.merge_cells("A2:C2")
for i, h in enumerate(["QMS Area", "Element", "Note"], start=1):
    ws.cell(row=4, column=i, value=h)
style_header(ws, 4, 3, height=20)
m2_areas = [(a, e, "For sterile product only" if e.startswith("Sterile") else "")
            for (a, e, iso, q, qsr, m2f, tc) in E if m2f.startswith("Y") and a != "OAFR"]
m2_oafr = [(a, e, "Evaluated in every risk-based inspection except PMA preapproval"
            + (" (where a tracking order was issued)" if "Tracking" in e else ""))
           for (a, e, iso, q, qsr, m2f, tc) in E if a == "OAFR"]
row = 5
for block_title, block in (("QMS Area elements prescribed for Model 2", m2_areas),
                           ("Other Applicable FDA Requirements (both models on baseline surveillance; excluded on PMA preapproval)", m2_oafr)):
    c = ws.cell(row=row, column=1, value=block_title)
    c.font = Font(name=FONT, bold=True, size=10, color=GOLD)
    for i in range(1, 4):
        ws.cell(row=row, column=i).fill = PatternFill("solid", fgColor=TINT)
        ws.cell(row=row, column=i).border = BOX
    row += 1
    start = row
    for j, rw in enumerate(block):
        for i, v in enumerate(rw, start=1):
            cc = ws.cell(row=row, column=i, value=v)
            cc.font = Font(name=FONT, size=9)
            cc.alignment = Alignment(wrap_text=True, vertical="top")
            cc.border = BOX
            cc.fill = PatternFill("solid", fgColor=TINT2 if j % 2 == 0 else "FFFFFF")
        row += 1
    ws.cell(row=row, column=1, value="Count").font = Font(name=FONT, bold=True, size=9)
    ws.cell(row=row, column=2, value=f"=COUNTA(B{start}:B{row-1})").font = Font(name=FONT, bold=True, size=9)
    ws.cell(row=row, column=1).border = BOX
    ws.cell(row=row, column=2).border = BOX
    row += 2
ws.cell(row=row, column=1, value="Reading the counts").font = Font(name=FONT, bold=True, size=10, color=NAVY)
ws.cell(row=row, column=2, value="23 QMS Area elements are listed, of which the sterile-product element applies only to sterile product: 23 for sterile product, 22 for non-sterile. The general items (registration and listing, marketing authorizations, previous 483 and compliance issues, and any areas defined in the assignment) are additional under both models. The four OAFRs are not: they are evaluated on a baseline surveillance inspection but excluded on a PMA preapproval inspection, which is Model 2's other use, and Medical Device Tracking is evaluated only where a tracking order was issued.")
ws.merge_cells(start_row=row, start_column=2, end_row=row, end_column=3)
ws.cell(row=row, column=2).font = Font(name=FONT, size=9, italic=True, color=GREY)
ws.cell(row=row, column=2).alignment = Alignment(wrap_text=True, vertical="top")
ws.row_dimensions[row].height = 62
ws.freeze_panes = "A5"

# =====================================================================
# Sheet 5: 820.35 and 820.45 checklists
# =====================================================================
ws = wb.create_sheet("820.35 and 820.45 checks")
widths(ws, {"A": 12, "B": 62, "C": 14, "D": 40, "E": 14})
ws.cell(row=1, column=1, value="Record content checklists: 21 CFR 820.35 and 820.45").font = Font(name=FONT, bold=True, size=13, color=NAVY)
ws.cell(row=2, column=1, value="Run these against your own templates and against sampled records. Pale yellow columns are inputs. These are the two provisions ISO 13485-certified firms most often had to add.").font = Font(name=FONT, size=9, italic=True, color=GREY)
CHK = [
 ("§820.35(a)", "Records of the review, evaluation and investigation are maintained for any complaint involving the possible failure of a device, labeling or packaging to meet any of its specifications"),
 ("§820.35(a)", "Where a similar complaint was already investigated and no new investigation is performed, records document the justification"),
 ("§820.35(a)(1)", "The name of the device is recorded"),
 ("§820.35(a)(2)", "The date the complaint was received is recorded"),
 ("§820.35(a)(3)", "Any UDI or UPC, and any other device identification, is recorded"),
 ("§820.35(a)(4)", "The name, address and phone number of the complainant is recorded"),
 ("§820.35(a)(5)", "The nature and details of the complaint are recorded"),
 ("§820.35(a)(6)", "Any correction or corrective action taken is recorded"),
 ("§820.35(a)(7)", "Any reply to the complainant is recorded"),
 ("§820.10(b)(3)", "The Part 803 reportability decision and its rationale are documented for each complaint"),
 ("§820.35(b)(1)", "Servicing record: the name of the device serviced"),
 ("§820.35(b)(2)", "Servicing record: any UDI or UPC, and other device identification"),
 ("§820.35(b)(3)", "Servicing record: the date of service"),
 ("§820.35(b)(4)", "Servicing record: the individual(s) who serviced the device"),
 ("§820.35(b)(5)", "Servicing record: the service performed"),
 ("§820.35(b)(6)", "Servicing record: any test and inspection data, where the QMS generates such data as part of servicing"),
 ("Clause 7.5.4", "Servicing records are analysed to determine whether the information is to be handled as a complaint"),
 ("§820.35(c)", "The UDI is recorded for each medical device or batch of medical devices"),
 ("§820.35(d)", "Records the firm deems confidential are marked, before an inspection, to aid FDA disclosure determinations under Part 20"),
 ("§820.45 intro", "Documented procedures describe the activities that ensure the integrity, inspection, storage and operations for labeling and packaging"),
 ("§820.45(a)(1)", "Labeling examined for accuracy before release or storage: correct UDI or UPC, or other device identification"),
 ("§820.45(a)(2)", "Labeling examined for accuracy: expiration date"),
 ("§820.45(a)(3)", "Labeling examined for accuracy: storage instructions"),
 ("§820.45(a)(4)", "Labeling examined for accuracy: handling instructions"),
 ("§820.45(a)(5)", "Labeling examined for accuracy: any additional processing instructions"),
 ("§820.45(b)", "The release of the labeling for use is documented in accordance with Clause 4.2.5"),
 ("§820.45(c)", "Labeling and packaging operations prevent mix-ups, including inspection before use against the medical device file, with results documented"),
 ("§820.45(c)", "Where automated readers are used, a designated individual examines at minimum a representative sample of the labels checked"),
]
for i, h in enumerate(["Provision", "Requirement", "Met? (Y/N/NA)", "Evidence or gap", "Owner"], start=1):
    ws.cell(row=4, column=i, value=h)
style_header(ws, 4, 5, height=20)
for j, (prov, req) in enumerate(CHK):
    r = 5 + j
    for i, v in enumerate([prov, req, "", "", ""], start=1):
        c = ws.cell(row=r, column=i, value=v)
        c.font = Font(name=FONT, size=9, color="0000FF" if i >= 3 else "000000", bold=(i == 1))
        c.alignment = Alignment(wrap_text=True, vertical="top")
        c.border = BOX
        if i >= 3:
            c.fill = PatternFill("solid", fgColor=YELLOW)
        else:
            c.fill = PatternFill("solid", fgColor=TINT2 if j % 2 == 0 else "FFFFFF")
r = 5 + len(CHK) + 1
ws.cell(row=r, column=2, value="Items met").font = Font(name=FONT, bold=True, size=10)
ws.cell(row=r, column=3, value=f'=COUNTIF(C5:C{4+len(CHK)},"Y")').font = Font(name=FONT, bold=True, size=10)
ws.cell(row=r + 1, column=2, value="Items not met").font = Font(name=FONT, bold=True, size=10)
ws.cell(row=r + 1, column=3, value=f'=COUNTIF(C5:C{4+len(CHK)},"N")').font = Font(name=FONT, bold=True, size=10)
ws.cell(row=r + 2, column=2, value="Items not yet assessed").font = Font(name=FONT, bold=True, size=10)
ws.cell(row=r + 2, column=3, value=f'={len(CHK)}-COUNTIF(C5:C{4+len(CHK)},"Y")-COUNTIF(C5:C{4+len(CHK)},"N")-COUNTIF(C5:C{4+len(CHK)},"NA")').font = Font(name=FONT, bold=True, size=10)
dv = DataValidation(type="list", formula1='"Y,N,NA"', allow_blank=True)
ws.add_data_validation(dv); dv.add(f"C5:C{4+len(CHK)}")
ws.freeze_panes = "A5"

# =====================================================================
# Sheet 6: Crosswalk
# =====================================================================
CROSSWALK = [
 ("820.5 Quality system","4.1","§820.10(a)","Risk-based approach to QMS processes (4.1.2 b); outsourced processes (4.1.5); QMS software validation (4.1.6)"),
 ("820.20 Management responsibility","5.1-5.6","-","'Top management' replaces 'management with executive responsibility'; management review inputs (5.6.2) now inspectable"),
 ("820.22 Quality audit","8.2.4","-","Audit reports reviewable by FDA; the audit programme should cover the six QMS Areas and risk integration"),
 ("820.25 Personnel","6.2","-","Competence on education, training, skills and experience; training effectiveness proportionate to risk"),
 ("820.30 Design controls","7.3.1-7.3.10","§820.10(c)","Design and development file (7.3.10); the explicit independent reviewer of 820.30(e) is not carried over; risk management in 7.1"),
 ("820.40 Document controls","4.2.4, 4.2.5","§820.35","'Document' means establish, implement and maintain (Clause 0.2); records readily identifiable and retrievable"),
 ("820.50 Purchasing controls","7.4.1-7.4.3","-","Criteria, monitoring and re-evaluation proportionate to risk; supplier audit reports reviewable; outsourced processes under 4.1.5"),
 ("820.60 Identification","7.5.8","§820.10(b)(1)","UDI system documented per Part 830; UDI recorded per device or batch (§820.35(c))"),
 ("820.65 Traceability","7.5.9.1, 7.5.9.2","§820.10(b)(2), §820.10(d)","Old 820.65 withdrawn; implant traceability extended to life-supporting and life-sustaining devices"),
 ("820.70 Production and process controls","7.5.1, 6.3, 6.4.1, 6.4.2, 7.5.2","§820.45","Contamination control (6.4.2); process agents (7.5.2); software validation (4.1.6, 7.5.6, 7.6)"),
 ("820.72 Inspection, measuring and test equipment","7.6","-","Also requires validation of software used for monitoring and measurement"),
 ("820.75 Process validation","7.5.6, 7.5.7","-","The QMSR does not define 'process validation'; revalidation criteria must be defined; 7.5.7 explicit for sterile devices"),
 ("820.80 / 820.86 Acceptance activities and status","7.4.3, 8.2.6, 7.5.8","-","Purchased product verification proportionate to risk; product status identification"),
 ("820.90 Nonconforming product","8.3.1-8.3.4","§820.3(b) rework; §820.10(b)(4)","Concessions need justification and approval; rework only before release for distribution; post-distribution actions are Part 806"),
 ("820.100 Corrective and preventive action","8.5.1, 8.5.2, 8.5.3","-","Correction, corrective action and preventive action are distinct (ISO 9000); effectiveness verified; feedback as an input"),
 ("820.120 / 820.130 Device labeling and packaging","7.5.1","§820.45","Five-point examination before release or storage; documented release; mix-up prevention; human oversight of automated readers"),
 ("820.140 / 820.150 / 820.160 Handling, storage, distribution","7.5.11, 7.5.9.2","§820.10(d)","Risk-based preservation; consignee distribution records where 7.5.9.2 applies; obsolete product covered by 7.5.11"),
 ("820.170 Installation","7.5.3","-","No FDA supplement"),
 ("820.180 Records, general requirements","4.2.5","§820.35(a)-(d)","The §820.180(c) exemption for management review, quality audit and supplier audit reports is removed; confidentiality marking retained in §820.35(d)"),
 ("820.181 Device master record","4.2.3","-","Specifications and procedures now live in the medical device file; final design output is its starting point"),
 ("820.184 Device history record","7.5.1, 7.5.8, 7.5.9","§820.35(c)","No defined record type; content required in the medical device or batch record; UDI recorded per device or batch"),
 ("820.186 Quality system record","4.2","-","No defined record type; quality manual (4.2.2), documents (4.2.4), records (4.2.5)"),
 ("820.198 Complaint files","8.2.1, 8.2.2, 8.2.3","§820.35(a); §820.10(b)(3)","Seven record elements; documented justification when a similar complaint was already investigated; MDR evaluation under Part 803"),
 ("820.200 Servicing","7.5.4","§820.35(b)","Six servicing record elements including UDI; servicing records analysed to decide whether the information is a complaint"),
 ("820.250 Statistical techniques","8.4","-","Documented procedures for analysis of data; FDA recommends quantitative data commensurate with risk"),
]
ws = wb.create_sheet("Crosswalk")
widths(ws, {"A": 40, "B": 26, "C": 28, "D": 76})
ws.cell(row=1, column=1, value="Crosswalk: former QS regulation to ISO 13485:2016 and the QMSR").font = Font(name=FONT, bold=True, size=13, color=NAVY)
ws.cell(row=2, column=1, value="Industry-authored. FDA declined to publish a mapping of the QS regulation to the QMSR (final rule, Comment 18). The only official mapping is the subpart-level Table 1 in the 2022 proposed rule. Use this to orient, not as evidence.").font = Font(name=FONT, size=9, italic=True, color=GREY)
for i, h in enumerate(["Former QSR section", "ISO 13485:2016 clause(s)", "QMSR supplement", "Substantive delta to test with evidence"], start=1):
    ws.cell(row=4, column=i, value=h)
style_header(ws, 4, 4, height=20)
for j, row in enumerate(CROSSWALK):
    r = 5 + j
    for i, v in enumerate(row, start=1):
        c = ws.cell(row=r, column=i, value=v)
        c.font = Font(name=FONT, size=9, bold=(i == 1))
        c.alignment = Alignment(wrap_text=True, vertical="top")
        c.border = BOX
        c.fill = PatternFill("solid", fgColor=TINT2 if j % 2 == 0 else "FFFFFF")
ws.freeze_panes = "A5"

# =====================================================================
# Sheet 7: Metrics
# =====================================================================
METRICS = [
 ("CP 7382.850 elements with evidence sampled in the last 12 months", 1.00, "Gap workbook", ">="),
 ("Open inspection-critical gaps (high exposure, true regulatory gap)", 0, "Gap workbook", "<="),
 ("Median minutes to produce a requested record", 15, "Retrieval drills", "<="),
 ("Complaint records complete against the §820.35(a) elements", 1.00, "Complaint system audit", ">="),
 ("Servicing records with UDI and all required elements", 1.00, "Service records audit", ">="),
 ("Lots with a documented five-point label examination and release", 1.00, "Batch records", ">="),
 ("Risk files updated after complaint, CAPA or change triggers", 1.00, "Risk management system", ">="),
 ("CAPAs closed with effectiveness data", 1.00, "CAPA system", ">="),
 ("Critical suppliers with risk-tiered controls and a current evaluation", 1.00, "Supplier files", ">="),
 ("Internal audit coverage of the six QMS Areas and four OAFRs", 1.00, "Audit programme", ">="),
 ("Management review actions closed on time", 0.95, "Management review log", ">="),
 ("Competence verified for high-risk processes (beyond read-and-sign)", 1.00, "Training records", ">="),
]
ws = wb.create_sheet("Metrics")
widths(ws, {"A": 56, "B": 12, "C": 12, "D": 10, "E": 16, "F": 26, "G": 30})
ws.cell(row=1, column=1, value="Readiness metrics for management review").font = Font(name=FONT, bold=True, size=13, color=NAVY)
ws.cell(row=2, column=1, value="Choose five. Enter your actual in the pale yellow column; Status is a formula. Percentages are stored as fractions, so enter 0.95 for 95%.").font = Font(name=FONT, size=9, italic=True, color=GREY)
for i, h in enumerate(["Readiness metric", "Target", "Actual", "Test", "Status", "Data source", "Comment / action"], start=1):
    ws.cell(row=4, column=i, value=h)
style_header(ws, 4, 7, height=20)
for j, (m, target, src, test) in enumerate(METRICS):
    r = 5 + j
    pct = isinstance(target, float)
    vals = [m, target, None, test, None, src, ""]
    for i, v in enumerate(vals, start=1):
        c = ws.cell(row=r, column=i, value=v)
        c.font = Font(name=FONT, size=9, color="0000FF" if i in (3, 7) else "000000")
        c.alignment = Alignment(wrap_text=True, vertical="top")
        c.border = BOX
        if i in (3, 7):
            c.fill = PatternFill("solid", fgColor=YELLOW)
        else:
            c.fill = PatternFill("solid", fgColor=TINT2 if j % 2 == 0 else "FFFFFF")
        if i in (2, 3) and pct:
            c.number_format = "0.0%"
        elif i in (2, 3):
            c.number_format = "0"
    ws.cell(row=r, column=5).value = (
        f'=IF($C{r}="","not measured",IF($D{r}=">=",IF($C{r}>=$B{r},"Green","Red"),'
        f'IF($C{r}<=$B{r},"Green","Red")))')
ws.freeze_panes = "A5"

# =====================================================================
# Sheet 8: Roadmap
# =====================================================================
ROADMAP = [
 ("0  Mobilize", "Charter, executive sponsor, scope and applicability statement (products, sites, Part 4 applicability, Class I exclusions), one named owner per QMS process", "100% of QMS processes have a named owner", "Confirm owners; refresh the applicability statement", "Week 1"),
 ("1  Assess", "Evidence-based gap workbook covering every CP 7382.850 element, with an exposure-weighted heat map", "Every applicable requirement sampled with at least one record; heat map approved by top management", "Re-run on high-exposure rows only", "Weeks 1-3"),
 ("2  Design", "Document architecture decision (rewrite, bridge or hybrid); controlled definitions table; procedure change list; template changes for complaint, service, label release, supplier file and management review agenda", "Every gap linked to a specific change with an owner and a date", "Confirm templates carry the §820.35 and §820.45 elements", "Weeks 3-5"),
 ("3  Implement and train", "Revised procedures effective; templates live; competence verified with methods proportionate to risk (Clause 6.2)", "% procedures effective; % staff competence-verified; % new records on the new templates in the first 30 days", "Refresh training for front-room staff", "Weeks 5-9"),
 ("4  Verify", "Internal audit conducted the way CP 7382.850 would; record-retrieval drills; mock inspection under the applicable model", "Zero inspection-critical findings open; median record retrieval under 15 minutes; every mock 483 item closed with evidence", "Enter here now", "Weeks 9-13"),
 ("5  Sustain", "Readiness metrics in management review; quarterly retrieval drills; watch list monitored; risk file updated on every trigger", "Metrics green two quarters running; every complaint, change and CAPA visibly updates the risk file", "Ongoing", "After week 13"),
]
ws = wb.create_sheet("Roadmap")
widths(ws, {"A": 22, "B": 54, "C": 50, "D": 30, "E": 14, "F": 18, "G": 12, "H": 14})
ws.cell(row=1, column=1, value="Transition roadmap: five phases, two tracks").font = Font(name=FONT, bold=True, size=13, color=NAVY)
ws.cell(row=2, column=1, value="Track A: transition complete, verifying and hardening for the first inspection. Track B: still closing gaps, compressing phases 1 to 4 into 90 days, load-bearing provisions first. Pale yellow columns are inputs.").font = Font(name=FONT, size=9, italic=True, color=GREY)
for i, h in enumerate(["Phase", "Deliverable", "Exit criterion", "Track A action", "Track B timing", "Owner", "Due date", "Status"], start=1):
    ws.cell(row=4, column=i, value=h)
style_header(ws, 4, 8, height=24)
for j, row in enumerate(ROADMAP):
    r = 5 + j
    for i, v in enumerate(list(row) + ["", "", ""], start=1):
        c = ws.cell(row=r, column=i, value=v)
        c.font = Font(name=FONT, size=9, bold=(i == 1), color="0000FF" if i >= 6 else "000000")
        c.alignment = Alignment(wrap_text=True, vertical="top")
        c.border = BOX
        if i >= 6:
            c.fill = PatternFill("solid", fgColor=YELLOW)
        else:
            c.fill = PatternFill("solid", fgColor=TINT2 if j % 2 == 0 else "FFFFFF")
    ws.row_dimensions[r].height = 56
dv = DataValidation(type="list", formula1='"Not started,In progress,Complete"', allow_blank=True)
ws.add_data_validation(dv); dv.add("H5:H10")
ws.freeze_panes = "A5"

# ---- print setup: wide sheets landscape and fitted to page width
for name in wb.sheetnames:
    sh = wb[name]
    sh.page_setup.orientation = "landscape" if name not in ("Read me", "Metrics") else "portrait"
    sh.page_setup.fitToWidth = 1
    sh.page_setup.fitToHeight = 0
    sh.sheet_properties.pageSetUpPr.fitToPage = True
    sh.print_options.horizontalCentered = False
    sh.oddFooter.center.text = "QMSR Gap Assessment Workbook  -  Elder Consulting, LLC  -  &A  -  page &P of &N"
    sh.oddFooter.center.size = 8
    if sh.freeze_panes and sh.freeze_panes[1:].isdigit():
        sh.print_title_rows = f"1:{int(sh.freeze_panes[1:]) - 1}"

wb.save("out/QMSR-Gap-Assessment-Workbook.xlsx")
print("wrote out/QMSR-Gap-Assessment-Workbook.xlsx; sheets:", wb.sheetnames)
