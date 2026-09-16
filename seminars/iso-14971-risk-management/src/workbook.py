"""Builds the ISO 14971 Risk File Toolkit workbook.

Sheet structure follows the required contents of a risk management plan
(ISO 14971:2019 Clause 4.4 a) to g)) and of a risk management file
(Clause 4.5), the risk analysis / evaluation / control / residual-risk
sequence of Clauses 5 to 8, and the production and post-production
information activity of Clause 10.

The severity and probability scales, the P1 x P2 combination table and the
risk acceptability matrix are EXAMPLES. ISO 14971:2019 Clause 4.4 d) requires
the manufacturer to define its own criteria for risk acceptability in the
risk management plan; ISO/TR 24971:2020 Clause 4.4 gives guidance on doing so.
Replace them on the 'Scales' sheet before use.

Worked example device: a programmable ambulatory infusion pump for home use
with a single-use administration set. The example rows are illustrative and
are not a risk analysis of any real product.
"""
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from datetime import date

NAVY = "0F2A4A"; GOLD = "A8730F"; TINT = "EAF0F6"; TINT2 = "F5F8FB"; INK = "1F2933"
YELLOW = "FFF9E0"; LINE = "CBD2D9"; GREY = "5A6B7B"
RED = "F9ECEA"; GREEN = "E8F3EE"; AMBER = "FBF2DE"
FONT = "Arial"

thin = Side(style="thin", color=LINE)
BOX = Border(left=thin, right=thin, top=thin, bottom=thin)

def style_header(ws, row, ncols, height=46):
    ws.row_dimensions[row].height = height
    for c in range(1, ncols + 1):
        cell = ws.cell(row=row, column=c)
        cell.font = Font(name=FONT, bold=True, color="FFFFFF", size=9)
        cell.fill = PatternFill("solid", fgColor=NAVY)
        cell.alignment = Alignment(wrap_text=True, vertical="center")
        cell.border = BOX

def title_block(ws, title, subtitle):
    ws["A1"] = title
    ws["A1"].font = Font(name=FONT, bold=True, size=14, color=NAVY)
    ws["A2"] = subtitle
    ws["A2"].font = Font(name=FONT, size=9, italic=True, color=GREY)
    ws.row_dimensions[1].height = 20

def widths(ws, spec):
    for col, w in spec.items():
        ws.column_dimensions[col].width = w

def body(ws, row, ncols, fill=None, height=None, wrap=True, size=9):
    if height:
        ws.row_dimensions[row].height = height
    for c in range(1, ncols + 1):
        cell = ws.cell(row=row, column=c)
        cell.font = Font(name=FONT, size=size)
        cell.alignment = Alignment(wrap_text=wrap, vertical="top")
        cell.border = BOX
        if fill:
            cell.fill = PatternFill("solid", fgColor=fill)

def inputs(ws, row, cols):
    """Pale-yellow fill marks a cell the user fills in."""
    for c in cols:
        ws.cell(row=row, column=c).fill = PatternFill("solid", fgColor=YELLOW)

def print_setup(ws, cols, rows_repeat=None, landscape=True, one_page=False):
    ws.page_setup.orientation = "landscape" if landscape else "portrait"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 1 if one_page else 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    if rows_repeat:
        ws.print_title_rows = rows_repeat
    ws.oddFooter.center.text = "Elder Consulting, LLC  |  ISO 14971 Risk File Toolkit  |  Page &P of &N"
    ws.oddFooter.center.size = 8
    ws.oddFooter.center.color = "5A6B7B"

wb = Workbook()

# =====================================================================
# Sheet 1: Read me
# =====================================================================
ws = wb.active
ws.title = "Read me"
widths(ws, {"A": 30, "B": 106})
title_block(ws, "ISO 14971 Risk File Toolkit",
            "Companion to the workshop 'Risk Management (ISO 14971): aligning risk files with EU MDR and FDA expectations'")
rows = [
    ("", ""),
    ("Purpose", "A working skeleton of a risk management file that is traceable end to end: every hazard reaches a harm, every unacceptable risk reaches a control, every control reaches a verification of implementation AND a verification of effectiveness, and every residual risk reaches either an acceptability decision or a benefit-risk record."),
    ("Why it is built this way", "Notified bodies and FDA investigators do not read a risk file to see whether it exists. They pull one hazard and walk it: to the design input, to the verification record, to the labelling, to the complaint data. The columns here are the walk. If a column is empty, that is where the deficiency is written."),
    ("", ""),
    ("How to use it", "1. Fill in 'RM Plan' first. Clause 4.4 requires the plan to define the acceptability criteria BEFORE the analysis. A file whose criteria were written after the risk table is the single most common finding in this area."),
    ("", "2. Edit 'Scales'. The severity scale, the two probability scales, the P1 x P2 combination table and the acceptability matrix in this workbook are examples. Replace them with your own and record the rationale."),
    ("", "3. Work 'Hazard Analysis' left to right, one row per hazardous situation (not one row per hazard). The initial and residual risk columns are formulas; do not overwrite them."),
    ("", "4. Every risk control gets a row on 'Risk Controls' with both verification references. Implementation and effectiveness are two separate records under Clause 7.2."),
    ("", "5. Residual risks that the criteria do not accept and that cannot be reduced further go to 'Benefit-Risk' under Clause 7.4 or Clause 8."),
    ("", "6. 'Prod & Post-Prod' is Clause 10. It is the sheet that makes the file living rather than historical, and it is the sheet auditors find empty."),
    ("", "7. 'RM File Index' is the Clause 4.5 index. 'Dashboard' tells you what is still missing."),
    ("", ""),
    ("Cells to fill in", "Every cell with a pale yellow fill is an input. Unshaded cells carry reference data or formulas."),
    ("Formula columns", "'Hazard Analysis' columns L to O and U to X; the checks on 'Risk Controls'; every figure on 'Dashboard'; the completeness line on 'RM File Index'. These recalculate from your inputs."),
    ("", ""),
    ("Clause map", "RM Plan = 4.4.  Scales = 4.4 d).  Hazard Analysis = 5.4 and 5.5 (analysis), 6 (evaluation), 7.1 (control option), 7.3 (residual risk evaluation), 7.6 (completeness).  Risk Controls = 7.1, 7.2 and 7.5.  Residual Risk = 8.  Benefit-Risk = 7.4 and 8.  Prod & Post-Prod = 10.1 to 10.4.  RM File Index = 4.5."),
    ("Clause 7 in full", "7.1 Risk control option analysis; 7.2 Implementation of risk control measures; 7.3 Residual risk evaluation; 7.4 Benefit-risk analysis; 7.5 Risks arising from risk control measures; 7.6 Completeness of risk control. Clause 7 runs to 7.6. Note that Clause 6 routes an acceptable risk straight to 7.6 and treats the estimated risk as the residual risk, so 7.6 applies to every hazardous situation, acceptable or not."),
    ("", ""),
    ("One row per hazardous situation", "ISO 14971:2019 Clause 5.4 asks for the foreseeable sequences of events that can lead a hazard to a hazardous situation. A single hazard (for example 'energy - electrical') produces several hazardous situations by several sequences, and each carries its own probability. Collapsing them into one row is what makes a probability estimate unjustifiable."),
    ("P1 and P2", "The probability of harm is decomposed into P1, the probability of the hazardous situation arising, and P2, the probability that the hazardous situation leads to the harm. ISO 14971:2019 Annex C.5 and ISO/TR 24971:2020 Clause 5.5 describe the decomposition. The combination table on 'Scales' is derived from the decade midpoints of the two scales; the derivation is shown there so a reviewer can audit it."),
    ("Acceptable is not the finish line", "The matrix produces 'Acceptable' or 'Not acceptable' against the example criteria. That is not the whole EU test. MDR Annex I point 4 requires risk control measures in a fixed order of priority, and point 2 defines the only permitted limit on how far you must go: reduction of risks as far as possible means reduction without adversely affecting the benefit-risk ratio. Cost is not in that sentence. So an 'Acceptable' verdict does not end the obligation to consider further risk control - record why no further control was practicable."),
    ("AFAP is not ALARP", "ALARP - as low as reasonably practicable - admits economic impact into the judgement. The MDR does not: the word ALARP does not appear in the Regulation, nor does any reference to economic considerations, and the recital of Directive 93/42/EEC that allowed 'technical and economical considerations' was not carried into the MDR. ISO/TR 24971:2020 Annex C is where the choice between ALARP, AFAP, ALARA and ALAP is actually discussed, as guidance on the Clause 4.2 policy."),
    ("What Annex ZA does and does not give you", "EN ISO 14971:2019/A11:2021 replaces the European foreword and adds Annexes ZA (MDR) and ZB (IVDR). It does not change the normative text of ISO 14971:2019. Annex ZA is a correspondence table, not a list of deviations: the seven content deviations people still cite belong to the withdrawn EN ISO 14971:2012. And the table is narrow - it addresses MDR Annex I Chapter I points 3, 4, 5, 8 and 9. Points 1, 2 and 7, and the whole of Chapters II and III, are not listed as covered, so conformity to the standard buys you no presumption of conformity with the benefit-risk requirement in point 1 or the AFAP definition in point 2. You argue those from the Regulation."),
    ("No middle band", "ISO 14971:2019 does not use a three-region ALARP matrix. If your matrix has an amber 'acceptable with justification' band carried over from the 2007 edition, expect to be asked which clause it implements."),
    ("", ""),
    ("Sheets", "Read me | RM Plan | Scales | Hazard Analysis | Risk Controls | Residual Risk | Benefit-Risk | Prod & Post-Prod | RM File Index | Dashboard"),
    ("", ""),
    ("Worked example", "The 16 example rows describe a programmable ambulatory infusion pump for home use with a single-use administration set. They are written to be argued with in the workshop, not copied. Two rows contain deliberate defects; the facilitator guide names them."),
    ("", ""),
    ("Standards referenced", "ISO 14971:2019 Medical devices - Application of risk management to medical devices, third edition, December 2019, confirmed March 2025 (clause numbers and required contents only; no text is reproduced). ISO/TR 24971:2020 Guidance on the application of ISO 14971. EN ISO 14971:2019 as amended by EN ISO 14971:2019/A11:2021, cited for the MDR by Commission Implementing Decision (EU) 2022/757 of 11 May 2022, OJ L 138, 17.5.2022, p. 27, and for the IVDR by Decision (EU) 2022/729, OJ L 135, 12.5.2022, p. 31. Related: IEC 62366-1 (usability), IEC 62304 (software life cycle), ISO 10993-1 (biological evaluation), ISO 11607 (sterile barrier)."),
    ("Regulation referenced", "Regulation (EU) 2017/745 (MDR), consolidated text of 9 July 2024: Articles 10(2) and 10(9)(e); Annex I Chapter I, the nine general requirements (point 1 benefit-risk and state of the art; point 2 the definition of as far as possible; point 3 the risk management system and its iterative process (a) to (f); point 4 the order of priority for risk control; point 5 use error; point 6 lifetime; point 7 transport and storage; point 8 risks and side-effects acceptable against the benefits; point 9 Annex XVI devices); Annex I Chapter II, points 10 to 22, the design and manufacture requirements; Annex I Chapter III, point 23, the information supplied with the device; Annex II point 5; Annex III point 1(b); Annex XIV Parts A and B; Articles 61, 83 to 86 and 88. 21 CFR Part 820 as in force from 2 February 2026, which incorporates ISO 13485:2016 by reference at 820.7."),
    ("A note on FDA", "ISO 14971 is not incorporated by reference into 21 CFR Part 820, which incorporates ISO 13485:2016 and Clause 3 of ISO 9000:2015 and nothing else (QMSR final rule, Comment 9, 89 FR 7503). The risk management obligation FDA enforces runs through the ISO 13485:2016 clauses that Part 820 does incorporate, principally 4.1.2 b), 7.1, and the design, purchasing, production and measurement clauses; FDA named 4.1, 7.1, 7.3, 7.4, 7.5, 7.6 and 8.2 in its response to Comment 19. ISO 14971:2019 is an FDA-recognized consensus standard at recognition number 5-125, complete standard, so conformance can be declared in a submission; recognition is not incorporation. The string 14971 appears nowhere in the 78 pages of Compliance Program 7382.850."),
    ("No quantitative requirement", "FDA stated at its 14 January 2026 town hall that there is no QMSR or ISO 13485 requirement for a quantitative description of risk. A semi-quantitative scoring scheme like the one on the Scales sheet is a choice you make and must justify, not an obligation you inherit."),
    ("", ""),
    ("Verify before you rely on it", "Content was verified in September 2026. Standards, harmonised-standard citations and guidance change. Confirm against the primary sources before using this workbook as evidence."),
    ("Prepared by", "Elder Consulting, LLC. Workshop material; not legal or regulatory advice."),
]
r = 3
for k, v in rows:
    ws.cell(row=r, column=1, value=k).font = Font(name=FONT, bold=True, size=10, color=NAVY)
    ws.cell(row=r, column=1).alignment = Alignment(wrap_text=True, vertical="top")
    c = ws.cell(row=r, column=2, value=v)
    c.font = Font(name=FONT, size=10)
    c.alignment = Alignment(wrap_text=True, vertical="top")
    ws.row_dimensions[r].height = 13 if not v else max(13, 12.5 * (1 + len(v) // 112))
    r += 1
ws.sheet_view.showGridLines = False
print_setup(ws, 2, landscape=False)

# =====================================================================
# Sheet 2: RM Plan  (ISO 14971:2019 Clause 4.4)
# =====================================================================
ws = wb.create_sheet("RM Plan")
widths(ws, {"A": 7, "B": 40, "C": 54, "D": 26, "E": 13, "F": 26})
title_block(ws, "Risk management plan: required contents",
            "ISO 14971:2019 Clause 4.4 a) to g), plus the contents EU MDR and FDA submissions expect to find. Clause 4.4 requires the plan to be part of the risk management file.")
hdr = ["#", "Required content", "What a reviewer looks for", "Where it is in your plan", "Present?", "Owner"]
for i, h in enumerate(hdr, start=1):
    ws.cell(row=4, column=i, value=h)
style_header(ws, 4, 6)

PLAN = [
    ("4.4 a)", "Scope of the planned risk management activities",
     "The device, its accessories, the life-cycle phases covered, and the parts of the device or process that are excluded with a reason. A plan whose scope is 'the device' cannot be audited."),
    ("4.4 b)", "Assignment of responsibilities and authorities",
     "Named roles, not 'the team'. Who may approve a residual risk as acceptable, and who may approve an overall residual risk, are separate authorities and are the two that get asked about."),
    ("4.4 c)", "Requirements for review of risk management activities",
     "Which reviews happen, at which milestones, who attends, and what the review has to conclude. This is the hook that produces the Clause 9 report."),
    ("4.4 d)", "Criteria for risk acceptability, based on the manufacturer's policy for determining acceptable risk",
     "The criteria themselves, the policy they derive from, and the method for the case where the probability of occurrence of harm cannot be estimated. A file with a matrix and no policy behind it is the single most common deficiency in this clause."),
    ("4.4 d)", "Criteria for the case where probability cannot be estimated",
     "ISO 14971:2019 requires the criteria to include how risk is evaluated when probability of occurrence of harm cannot be estimated. In practice this means severity-only evaluation and a stated decision rule. Most plans are silent here."),
    ("4.4 e)", "Method to evaluate overall residual risk and the criteria for its acceptability",
     "Overall residual risk is a separate evaluation from the sum of individual risks (Clause 8). The plan must say how it is done and what makes it acceptable, before the answer is known."),
    ("4.4 f)", "Activities for verification of the implementation and effectiveness of risk control measures",
     "Two activities, not one, per Clause 7.2. What record proves the control was implemented, and what record proves it works."),
    ("4.4 g)", "Activities related to collection and review of relevant production and post-production information",
     "The named information sources, who reviews them, how often, and the trigger that sends a finding back into the risk file. This is the Clause 10 hook and it is the one auditors find missing."),
    ("MDR", "Link to the risk management system required by Article 10(2) and Annex I point 3",
     "Annex I point 3 requires the system and sets out the iterative process in sub-points (a) to (f); (a) is the risk management plan itself and (e) to (f) are the production and post-production feedback loop. Article 10(2) is the headline obligation and Article 10(9)(e) puts risk management inside the QMS. Name the procedure, and name where the risk management plan sits relative to the PMS plan (Annex III point 1(b), which requires indicators and threshold values) and the PMCF plan (Annex XIV Part B)."),
    ("MDR", "How the plan addresses GSPRs 1 to 9 and the AFAP obligation",
     "Annex I point 4 sets the order of priority for risk control: (a) safe design and manufacture, (b) protection measures including alarms, (c) information for safety and training, and it closes with 'Manufacturers shall inform users of any residual risks'. Point 2 defines the test: reducing risks as far as possible means reduction without adversely affecting the benefit-risk ratio - not cost. State which of the two you are applying, because Annex ZA of EN ISO 14971:2019/A11:2021 does not list points 1, 2 or 7 among the requirements it covers, so those are argued from the Regulation and not from the standard."),
    ("MDR", "Method for the benefit-risk determination and its acceptability criteria",
     "Annex I points 1 and 8 require risks and undesirable side-effects to be acceptable when weighed against the benefits. Say how clinical benefit is characterised (nature, magnitude, probability, duration) and against what the residual risk is weighed."),
    ("FDA", "Integration with the QMS processes FDA inspects",
     "21 CFR 820.7 incorporates ISO 13485:2016, so risk management is inspected through Clauses 4.1.2 b), 7.1 and the design, purchasing, production and measurement clauses. Say which procedures carry the risk interface, because that is the trail an investigator walks."),
    ("FDA", "Declaration of conformity to the recognized version of ISO 14971",
     "ISO 14971:2019 is an FDA-recognized consensus standard but is NOT incorporated by reference into Part 820. If you declare conformity in a submission, check the recognition number and any transition notice for the edition FDA currently recognises."),
    ("Both", "Competence of the persons performing risk management",
     "ISO 14971 Clause 4.3 requires the persons performing risk management tasks to be competent, with records. ISO 13485 Clause 6.2 is the QMS hook FDA inspects. Name the competence requirement and where the records live."),
    ("MDR", "A clinical expert assigned to the risk management team",
     "Team-NB's best practice guidance on technical documentation (V4, 21 April 2026) closes its list of risk management plan contents with a requirement for qualified persons, including the assignment of a clinical expert. Most plans name engineering and quality roles and stop. P2 is a clinical judgement, so somebody clinical has to own it."),
    ("MDR", "Cybersecurity, use-environment and user-competence hazards in scope of the analysis",
     "Team-NB section 5.3 names hazards related to cybersecurity, to ergonomic features, to the use environment, and to the technical knowledge, experience, education and training of the intended users. Say in the plan that these classes are in scope, because a reviewer will check whether the analysis reached them."),
    ("Both", "Plan revision control",
     "Clause 4.4 requires changes to the plan to be recorded in the risk management file. A plan at revision 1 alongside a risk table at revision 7 is a finding on its own."),
]
r = 5
for i, (cl, req, look) in enumerate(PLAN, start=1):
    ws.cell(row=r, column=1, value=cl)
    ws.cell(row=r, column=2, value=req)
    ws.cell(row=r, column=3, value=look)
    body(ws, r, 6, fill=TINT2 if i % 2 else None, height=max(30, 11 * (1 + len(look) // 62)))
    ws.cell(row=r, column=1).font = Font(name=FONT, size=8, bold=True, color=GOLD)
    ws.cell(row=r, column=2).font = Font(name=FONT, size=9, bold=True)
    inputs(ws, r, [4, 5, 6])
    r += 1
dv = DataValidation(type="list", formula1='"Yes,Partial,No,N/A"', allow_blank=True)
ws.add_data_validation(dv)
dv.add(f"E5:E{r-1}")
ws.freeze_panes = "A5"
print_setup(ws, 6, rows_repeat="4:4")

# =====================================================================
# Sheet 3: Scales  (example criteria; Clause 4.4 d))
# =====================================================================
ws = wb.create_sheet("Scales")
# Uniform widths from B onwards so the two 5x5 matrices below have even columns.
# The descriptive tables merge C:D and E:F to get the width they need.
widths(ws, {"A": 8, "B": 22, "C": 22, "D": 22, "E": 22, "F": 22})
title_block(ws, "Scales, combination table and acceptability criteria",
            "EXAMPLES. ISO 14971:2019 Clause 4.4 d) requires the manufacturer to define its own criteria in the risk management plan. Replace every value on this sheet and record the rationale.")

def note(row, text):
    """A wrapped note merged across A:F, so it does not widen the printed sheet."""
    c = ws.cell(row=row, column=1, value=text)
    c.font = Font(name=FONT, size=9, italic=True, color=GREY)
    c.alignment = Alignment(wrap_text=True, vertical="top")
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=6)
    ws.row_dimensions[row].height = max(12, 11 * (1 + len(text) // 118))

def subhead(row, text):
    ws.cell(row=row, column=1, value=text).font = Font(name=FONT, bold=True, size=11, color=NAVY)

def scale_table(r, headers, rows, wide_last):
    """4-logical-column table: A level, B label, C:D merged, E:F merged (or E alone)."""
    for i, h in enumerate(headers):
        ws.cell(row=r, column=[1, 2, 3, 5][i], value=h)
    ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=4)
    ws.merge_cells(start_row=r, start_column=5, end_row=r, end_column=6)
    style_header(ws, r, 6, height=28)
    first = r + 1
    for i, (lv, lab, mid_text, last) in enumerate(rows):
        r += 1
        ws.cell(row=r, column=1, value=lv)
        ws.cell(row=r, column=2, value=lab)
        ws.cell(row=r, column=3, value=mid_text)
        ws.cell(row=r, column=5, value=last)
        ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=4)
        ws.merge_cells(start_row=r, start_column=5, end_row=r, end_column=6)
        longest = max(len(str(mid_text)) // 44, len(str(last)) // (44 if wide_last else 22))
        body(ws, r, 6, fill=TINT2 if i % 2 else None, height=max(22, 12 * (1 + longest)))
        ws.cell(row=r, column=1).font = Font(name=FONT, size=9, bold=True)
        ws.cell(row=r, column=1).alignment = Alignment(horizontal="center", vertical="top")
        if not wide_last:
            ws.cell(row=r, column=5).alignment = Alignment(horizontal="center", vertical="top")
    return first, r

def matrix(r, corner, col_labels, row_labels, cell_fn):
    ws.cell(row=r, column=1, value=corner)
    for j, cl in enumerate(col_labels):
        ws.cell(row=r, column=2 + j, value=cl)
    style_header(ws, r, 6, height=20)
    first = r + 1
    for i, rl in enumerate(row_labels):
        rr = first + i
        c = ws.cell(row=rr, column=1, value=rl)
        c.font = Font(name=FONT, size=9, bold=True, color=NAVY)
        c.fill = PatternFill("solid", fgColor=TINT)
        c.border = BOX
        c.alignment = Alignment(horizontal="center", vertical="center")
        for j in range(len(col_labels)):
            val, fill, colour = cell_fn(i, j)
            cc = ws.cell(row=rr, column=2 + j, value=val)
            cc.font = Font(name=FONT, size=9, bold=True, color=colour)
            cc.alignment = Alignment(horizontal="center", vertical="center")
            cc.border = BOX
            cc.fill = PatternFill("solid", fgColor=fill)
        ws.row_dimensions[rr].height = 18
    return first, first + len(row_labels) - 1

r = 4
subhead(r, "Severity of harm")
SEV = [
    (5, "Catastrophic", "Results in patient death.", "Serious incident (Article 2(65)); reportable"),
    (4, "Critical", "Results in permanent impairment of a body function or permanent damage to a body structure, or a life-threatening illness or injury.", "Serious incident; reportable"),
    (3, "Serious", "Results in injury or impairment requiring professional medical intervention.", "Likely a serious deterioration in state of health; assess reportability"),
    (2, "Minor", "Results in temporary injury or impairment not requiring professional medical intervention.", "Usually not a serious incident; feeds trend reporting"),
    (1, "Negligible", "Inconvenience or temporary discomfort.", "Not a serious incident; feeds trend reporting"),
]
scale_table(r + 1, ["Level", "Label", "Description", "MDR reporting relevance"], SEV, True)
r += 7

subhead(r, "P1  -  probability of the hazardous situation arising")
note(r + 1, "Per device per year of use, unless the plan states another basis. State the basis; a band with no basis cannot be defended.")
P1 = [
    (5, "Frequent", "greater than or equal to 1 in 1,000", -2.5),
    (4, "Probable", "1 in 1,000 to 1 in 10,000", -3.5),
    (3, "Occasional", "1 in 10,000 to 1 in 100,000", -4.5),
    (2, "Remote", "1 in 100,000 to 1 in 1,000,000", -5.5),
    (1, "Improbable", "less than 1 in 1,000,000", -6.5),
]
scale_table(r + 2, ["Level", "Label", "Quantitative band", "log10 midpoint used below"], P1, False)
r += 9

subhead(r, "P2  -  conditional probability that the hazardous situation leads to the harm")
note(r + 1, "A conditional probability, so it is dimensionless. It carries the clinical argument: who is exposed, for how long, whether the harm is detectable and reversible, and whether anyone intervenes in time.")
P2 = [
    (5, "Almost certain", "greater than 0.9", 0.0),
    (4, "Likely", "0.1 to 0.9", -0.7),
    (3, "Possible", "0.01 to 0.1", -1.5),
    (2, "Unlikely", "0.001 to 0.01", -2.5),
    (1, "Very unlikely", "less than 0.001", -3.5),
]
scale_table(r + 2, ["Level", "Label", "Conditional probability band", "log10 midpoint used below"], P2, False)
r += 9

# --- P1 x P2 combination table, derived from the log10 midpoints above ---
P1_MID = {lv: mid for lv, _, _, mid in P1}
P2_MID = {lv: mid for lv, _, _, mid in P2}

def band_from_log(x):
    """Thresholds: >= -3 -> 5; -3 to -4 -> 4; -4 to -5 -> 3; -5 to -6 -> 2; < -6 -> 1."""
    if x >= -3: return 5
    if x >= -4: return 4
    if x >= -5: return 3
    if x >= -6: return 2
    return 1

subhead(r, "Combined probability of harm: P1 x P2")
note(r + 1, "Derived, not asserted. Combined log10 = P1 midpoint + P2 midpoint, banded at -3, -4, -5 and -6. The derivation is shown so a reviewer can audit it; if you change a midpoint, change the table.")
COMB_FIRST, COMB_LAST = matrix(
    r + 2, "P1 \\ P2", [f"P2 = {lv}" for lv in (5, 4, 3, 2, 1)], [f"P1 = {lv}" for lv in (5, 4, 3, 2, 1)],
    lambda i, j: (
        band_from_log(P1_MID[[5, 4, 3, 2, 1][i]] + P2_MID[[5, 4, 3, 2, 1][j]]),
        {5: RED, 4: RED, 3: AMBER, 2: GREEN, 1: GREEN}[band_from_log(P1_MID[[5, 4, 3, 2, 1][i]] + P2_MID[[5, 4, 3, 2, 1][j]])],
        INK))
COMB_RANGE = f"Scales!$B${COMB_FIRST}:$F${COMB_LAST}"
r = COMB_LAST + 2

# --- Risk acceptability matrix ---
ACCEPT = {  # P -> verdict over S = 1..5
    5: ("A", "NA", "NA", "NA", "NA"),
    4: ("A", "A", "NA", "NA", "NA"),
    3: ("A", "A", "NA", "NA", "NA"),
    2: ("A", "A", "A", "NA", "NA"),
    1: ("A", "A", "A", "A", "NA"),
}
subhead(r, "Risk acceptability matrix (example criteria)")
note(r + 1, "Two regions only. ISO 14971:2019 does not use a three-region ALARP matrix; an amber 'acceptable with justification' band is a hold-over from the 2007 edition. A 'Not acceptable' verdict routes to further risk control and, if none is practicable, to a benefit-risk analysis under Clause 7.4.")
note(r + 2, "An 'Acceptable' verdict does not end the obligation. MDR Annex I point 4 requires the order of priority to be worked, and point 2 sets the only permitted limit on how far: without adversely affecting the benefit-risk ratio. Record why no further control was practicable.")
ACC_FIRST, ACC_LAST = matrix(
    r + 3, "P \\ S", [f"S = {lv}" for lv in (1, 2, 3, 4, 5)], [f"P = {lv}" for lv in (5, 4, 3, 2, 1)],
    lambda i, j: (
        "Acceptable" if ACCEPT[[5, 4, 3, 2, 1][i]][j] == "A" else "Not acceptable",
        GREEN if ACCEPT[[5, 4, 3, 2, 1][i]][j] == "A" else RED,
        "256B4F" if ACCEPT[[5, 4, 3, 2, 1][i]][j] == "A" else "9E2F24"))
ACC_RANGE = f"Scales!$B${ACC_FIRST}:$F${ACC_LAST}"
r = ACC_LAST + 2

subhead(r, "Probability cannot be estimated")
note(r + 1, "Clause 4.4 d) requires the criteria to cover this case. Example rule, which you should replace: where the probability of occurrence of harm cannot be estimated, evaluate the risk on severity alone and treat severity 3 or above as not acceptable until a risk control is in place. Enter P1 = 0 on 'Hazard Analysis' to invoke this rule; the risk level column returns 'Severity only'.")
ws.sheet_view.showGridLines = False
print_setup(ws, 6, landscape=False, one_page=True)

# =====================================================================
# Sheet 4: Hazard Analysis  (Clauses 5.4, 5.5, 6, 7.1, 7.3, 7.4, 7.6)
# =====================================================================
ws = wb.create_sheet("Hazard Analysis")
HA_COLS = [
    ("A", 8,  "ID"),
    ("B", 18, "Device function or part"),
    ("C", 17, "Hazard\n(category)"),
    ("D", 42, "Foreseeable sequence of events\n(Clause 5.4)"),
    ("E", 28, "Hazardous situation\n(Clause 5.4)"),
    ("F", 26, "Harm\n(Clause 5.5)"),
    ("G", 15, "MDR Annex I\nGSPR link"),
    ("H", 6,  "P1\ninit"),
    ("I", 6,  "P2\ninit"),
    ("J", 6,  "S\ninit"),
    ("K", 26, "Basis for the estimate\n(record or source)"),
    ("L", 7,  "P\ninit"),
    ("M", 15, "Initial risk\n(formula)"),
    ("N", 6,  "Risk\nindex"),
    ("O", 13, "Control needed?\n(formula)"),
    ("P", 9,  "Primary\ncontrol ID"),
    ("Q", 5,  "Ctrl\ncat"),
    ("R", 6,  "P1\nres"),
    ("S", 6,  "P2\nres"),
    ("T", 6,  "S\nres"),
    ("U", 7,  "P\nres"),
    ("V", 15, "Residual risk\n(formula)"),
    ("W", 14, "Benefit-risk\nneeded? (formula)"),
    ("X", 26, "Completeness check\n(formula)"),
    ("Y", 14, "New risk from\nthe control?"),
    ("Z", 18, "Residual risk disclosure\n(IFU or label ref)"),
    ("AA", 12, "Status"),
]
widths(ws, {c: w for c, w, _ in HA_COLS})
title_block(ws, "Hazard analysis and risk evaluation",
            "One row per hazardous situation, not per hazard. A single hazard reaches several hazardous situations by several sequences, and each carries its own probability. Columns L to O and U to X are formulas.")
for i, (_, _, h) in enumerate(HA_COLS, start=1):
    ws.cell(row=4, column=i, value=h)
style_header(ws, 4, len(HA_COLS), height=44)
NC = len(HA_COLS)
HA_FIRST = 5

ROWS = [
    ("HZ-01", "Pumping mechanism and administration set",
     "Energy - mechanical (unintended delivery)",
     "Downstream occlusion raises pressure in the compliant administration set; the occlusion clears and the stored volume is released before the pump can decompress the line.",
     "Patient receives a bolus of drug well above the prescribed rate.",
     "Over-infusion: hypotension and respiratory depression.",
     "1, 4, 14.2(a), 21.1, 21.2", 4, 4, 4,
     "Complaint trend CT-2025-041; bench test BT-114 (post-occlusion bolus volume).",
     "RC-01", 1, 2, 4, 4, "Y - see HZ-17 (nuisance alarms)", "", "Closed"),
    ("HZ-02", "Administration set and roller clamp",
     "Energy - mechanical (free flow)",
     "User removes the administration set from the pump door without closing the roller clamp; the head height of the reservoir drives gravity flow to the patient.",
     "Patient is exposed to uncontrolled gravity infusion.",
     "Over-infusion: overdose, death.",
     "1, 4, 5, 21.1, 21.2", 4, 5, 5,
     "Use-related risk analysis URA-07; formative usability study US-03 (4 of 15 participants).",
     "RC-02", 1, 2, 5, 5, "N", "", "Closed"),
    ("HZ-03", "Air-in-line detector",
     "Energy and materials - air embolism",
     "Reservoir empties; air enters the fluid path; at low flow rates the bubble size stays below the detector's sensitivity threshold and accumulates undetected.",
     "Air bolus present in the venous line.",
     "Air embolism: stroke, death.",
     "1, 4, 14.2(e), 21.2", 3, 3, 5,
     "Detector characterisation report DR-22; literature on embolism thresholds by bolus volume.",
     "RC-03", 2, 2, 3, 5, "N", "", "Closed"),
    ("HZ-04", "User interface - rate programming",
     "Use error - data entry",
     "Clinician mis-keys a decimal point and enters ten times the intended rate; the confirmation screen displays the number without the drug and unit context needed to catch it.",
     "Pump is set to deliver ten times the prescribed rate.",
     "Over-infusion: overdose.",
     "1, 5, 14.6, 21.1, 21.3", 4, 4, 4,
     "Use-related risk analysis URA-11; summative usability study US-09 to IEC 62366-1.",
     "RC-04", 2, 2, 4, 4, "Y - see HZ-18 (limit override workaround)", "", "Open"),
    ("HZ-05", "Battery and power management",
     "Energy - loss of power",
     "Battery capacity degrades with cycling; the remaining-time indicator is computed from nominal rather than measured capacity, so the pump reaches cut-off earlier than the display predicts.",
     "Therapy is interrupted without usable warning.",
     "Under-infusion: loss of therapy; for a vasoactive drug, haemodynamic collapse.",
     "1, 4, 18.1, 18.2", 3, 4, 4,
     "Battery cycle-life test BT-208; field data on service age at failure.",
     "RC-05", 2, 2, 4, 4, "N", "", "Closed"),
    ("HZ-06", "Software - weight-based dose calculation",
     "Information - incorrect output",
     "The unit-conversion routine truncates instead of rounding when patient weight is entered in pounds, so the computed dose is systematically low for some weights.",
     "Pump is set to deliver a dose below the prescription.",
     "Under-infusion: therapeutic failure.",
     "1, 17.1, 17.2, 21.1", 2, 4, 3,
     "Software anomaly SA-31; unit test suite UT-dose; code review CR-14 (IEC 62304 Class C).",
     "RC-06", 1, 1, 4, 3, "N", "", "Closed"),
    ("HZ-07", "Wireless drug-library update",
     "Information - security",
     "An update package is accepted over the hospital network without authentication of its origin or integrity, replacing the hard dose limits on every pump that receives it.",
     "Hard dose limits are absent or wrong across a fleet of pumps.",
     "Over-infusion affecting multiple patients.",
     "1, 14.2(d), 17.2, 17.4, 18.8", 2, 3, 5,
     "Threat model TM-03; penetration test PT-09; SBOM review.",
     "RC-07", 1, 1, 3, 5, "N", "", "Open"),
    ("HZ-08", "Fluid path sterile barrier",
     "Biological - contamination",
     "Pouch seal strength is specified below what the distribution profile demands; the seal channels in transit and the breach is not visible to the user at the point of use.",
     "Non-sterile fluid path is placed in contact with the bloodstream.",
     "Bloodstream infection: sepsis.",
     "1, 11.1, 11.4, 11.7", 2, 3, 4,
     "Package validation PV-05 to ISO 11607-1 and -2; distribution test to ASTM D4169.",
     "RC-08", 1, 1, 3, 4, "N", "", "Closed"),
    ("HZ-09", "Administration set material",
     "Biological - chemical (leachables)",
     "A lipophilic drug is infused over 24 hours through a plasticised PVC set; the plasticiser partitions into the drug solution and is delivered to the patient.",
     "Patient is exposed to the plasticiser above the tolerable intake.",
     "Reproductive toxicity; long latency, not attributable at the time of use.",
     "1, 10.1, 10.3, 10.4.1, 10.4.2", 5, 2, 3,
     "Biological evaluation BE-02 to ISO 10993-1; extractables and leachables study EL-06; toxicological risk assessment TRA-03.",
     "RC-09", 1, 1, 2, 3, "N", "", "Closed"),
    ("HZ-10", "Alarm system - audible alarm",
     "Information - alarm not perceived",
     "The device is used at home overnight; the occlusion alarm at the specified sound pressure level is masked by ambient noise and the sleeping patient does not wake.",
     "An occlusion persists undetected for several hours.",
     "Under-infusion: loss of therapy.",
     "1, 5, 18.4, 21.2, 22.1", 3, 4, 3,
     "Alarm audibility test AT-04 to IEC 60601-1-8; home-use environment characterisation HE-02.",
     "RC-10", 2, 2, 3, 3, "N", "", "Closed"),
    ("HZ-11", "Durable pump enclosure - cleaning between patients",
     "Biological - cross-contamination",
     "The enclosure is wiped with a disinfectant not on the validated list; the material at a moulded joint degrades and retains residue and microbial load that the next clean does not remove.",
     "Residue and microbial load are transferred between patients.",
     "Cross-infection.",
     "1, 11.1, 11.2", 3, 2, 3,
     "Cleaning validation CV-03; material compatibility test MC-11 over 200 cycles.",
     "RC-11", 3, 3, 2, 3, "N", "IFU section 7.3; label symbol", "Closed"),
    ("HZ-12", "Administration set patient connector",
     "Energy - misconnection",
     "The set terminates in a connector that will physically mate with an enteral feeding port, and both routes are present at the bedside.",
     "An enteral route is connected to an intravenous port, or the reverse.",
     "Wrong-route administration: death.",
     "1, 4, 14.1", 2, 5, 5,
     "Connector conformance test CC-02 to ISO 80369-3 and -7; published wrong-route incident literature.",
     "RC-12", 1, 1, 5, 5, "N", "", "Closed"),
    ("HZ-13", "Transport and storage",
     "Environmental - temperature",
     "The device is left in a vehicle overnight below the specified storage range; the display and battery fall out of specification and the device fails its power-on self-test.",
     "Therapy cannot be started when it is needed.",
     "Delay of therapy.",
     "1, 7, 14.2(b), 23.4", 3, 3, 2,
     "Environmental test ET-07; transport simulation TS-02.",
     "RC-13", 3, 3, 3, 2, "N", "IFU section 4.1; carton label", "Closed"),
    ("HZ-14", "Disposal of the used administration set",
     "Environmental and biological - third-party exposure",
     "A home user disposes of a set holding residual cytotoxic drug in general household waste; a carer or waste handler contacts the residue.",
     "A third party is exposed to cytotoxic residue.",
     "Chemical injury to a carer or waste handler.",
     "1, 14.7, 23.4", 3, 2, 3,
     "Residual volume measurement RV-01; carer interviews in use-related risk analysis URA-14.",
     "RC-14", 2, 2, 2, 3, "N", "IFU section 9; disposal pictogram", "Open"),
    # --- deliberate defect 1: the collapsed row ---
    ("HZ-15", "Pumping mechanism",
     "Pump failure",
     "Pump fails.",
     "Pump failure.",
     "Harm to patient.",
     "", 2, 2, 3,
     "",
     "", None, None, None, None, "", "", "Open"),
    # --- deliberate defect 2: information for safety credited with a probability drop ---
    ("HZ-16", "User interface - alarm silence",
     "Use error - alarm silenced",
     "User silences the alarm.",
     "Alarm silenced.",
     "Delay of therapy.",
     "1", 5, 5, 4,
     "Engineering judgement.",
     "RC-16", 3, 1, 1, 4, "N", "", "Closed"),
]

TOTAL_ROWS = 40  # 16 worked examples plus blank rows carrying the same formulas
r = HA_FIRST
for idx in range(TOTAL_ROWS):
    d = ROWS[idx] if idx < len(ROWS) else None
    if d:
        (hid, part, haz, seq, situ, harm, gspr, p1, p2, sv, basis,
         rc, cat, rp1, rp2, rsv, newrisk, disc, status) = d
        ws.cell(row=r, column=1, value=hid)
        ws.cell(row=r, column=2, value=part)
        ws.cell(row=r, column=3, value=haz)
        ws.cell(row=r, column=4, value=seq)
        ws.cell(row=r, column=5, value=situ)
        ws.cell(row=r, column=6, value=harm)
        ws.cell(row=r, column=7, value=gspr)
        ws.cell(row=r, column=8, value=p1)
        ws.cell(row=r, column=9, value=p2)
        ws.cell(row=r, column=10, value=sv)
        ws.cell(row=r, column=11, value=basis)
        ws.cell(row=r, column=16, value=rc)
        ws.cell(row=r, column=17, value=cat)
        ws.cell(row=r, column=18, value=rp1)
        ws.cell(row=r, column=19, value=rp2)
        ws.cell(row=r, column=20, value=rsv)
        ws.cell(row=r, column=25, value=newrisk)
        ws.cell(row=r, column=26, value=disc)
        ws.cell(row=r, column=27, value=status)

    # ---- formulas, on every row whether or not it carries an example ----
    ws.cell(row=r, column=12, value=(
        f'=IF($H{r}="","",IF($H{r}=0,"n/e",INDEX({COMB_RANGE},6-$H{r},6-$I{r})))'))
    ws.cell(row=r, column=13, value=(
        f'=IF($L{r}="","",IF($L{r}="n/e",IF($J{r}>=3,"Not acceptable (S only)","Acceptable (S only)"),'
        f'INDEX({ACC_RANGE},6-$L{r},$J{r})))'))
    ws.cell(row=r, column=14, value=f'=IF(OR($L{r}="",$L{r}="n/e"),"",$L{r}*$J{r})')
    ws.cell(row=r, column=15, value=(
        f'=IF($M{r}="","",IF(LEFT($M{r},3)="Not","Yes - Clause 7.1","Consider AFAP"))'))
    ws.cell(row=r, column=21, value=(
        f'=IF($R{r}="","",IF($R{r}=0,"n/e",INDEX({COMB_RANGE},6-$R{r},6-$S{r})))'))
    ws.cell(row=r, column=22, value=(
        f'=IF($U{r}="","",IF($U{r}="n/e",IF($T{r}>=3,"Not acceptable (S only)","Acceptable (S only)"),'
        f'INDEX({ACC_RANGE},6-$U{r},$T{r})))'))
    ws.cell(row=r, column=23, value=(
        f'=IF($V{r}="","",IF(LEFT($V{r},3)="Not","Yes - Clause 7.4","No"))'))
    ws.cell(row=r, column=24, value=(
        f'=IF($A{r}="","",'
        f'IF($G{r}="","GSPR link missing",'
        f'IF($K{r}="","Basis for estimate missing",'
        f'IF(AND(LEFT($O{r},3)="Yes",$P{r}=""),"Risk control missing",'
        f'IF(AND($P{r}<>"",COUNTIF(\'Risk Controls\'!$A:$A,$P{r})=0),"Control not on Risk Controls",'
        f'IF(AND($P{r}<>"",$R{r}=""),"Residual risk not estimated",'
        f'IF(AND($P{r}<>"",COUNTIFS(\'Risk Controls\'!$A:$A,$P{r},\'Risk Controls\'!$H:$H,"<>")=0),"Effectiveness not verified",'
        f'IF(AND($Q{r}=3,$Z{r}=""),"Disclosure reference missing",'
        f'IF(AND(LEFT($W{r},3)="Yes",COUNTIF(\'Benefit-Risk\'!$A:$A,$A{r})=0),"Benefit-risk record missing",'
        f'"Complete")))))))))'))

    body(ws, r, NC, fill=TINT2 if idx % 2 else None,
         height=max(26, 10.5 * (1 + len(d[3]) // 44)) if d else 22, size=8.5)
    for c in (8, 9, 10, 17, 18, 19, 20):
        ws.cell(row=r, column=c).alignment = Alignment(horizontal="center", vertical="top")
    for c in (12, 14, 21):
        ws.cell(row=r, column=c).alignment = Alignment(horizontal="center", vertical="top")
        ws.cell(row=r, column=c).font = Font(name=FONT, size=8.5, bold=True)
    for c in (13, 22):
        ws.cell(row=r, column=c).font = Font(name=FONT, size=8, bold=True)
    ws.cell(row=r, column=1).font = Font(name=FONT, size=8.5, bold=True, color=NAVY)
    inputs(ws, r, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 16, 17, 18, 19, 20, 25, 26, 27])
    inputs(ws, r, [1])
    r += 1
HA_LAST = r - 1

dv_l = DataValidation(type="list", formula1='"5,4,3,2,1,0"', allow_blank=True,
                      prompt="5 to 1 per the Scales sheet. Enter 0 where the probability cannot be estimated.",
                      promptTitle="Probability band")
ws.add_data_validation(dv_l)
for col in ("H", "I", "R", "S"):
    dv_l.add(f"{col}{HA_FIRST}:{col}{HA_LAST}")
dv_s = DataValidation(type="list", formula1='"5,4,3,2,1"', allow_blank=True)
ws.add_data_validation(dv_s); dv_s.add(f"J{HA_FIRST}:J{HA_LAST}"); dv_s.add(f"T{HA_FIRST}:T{HA_LAST}")
dv_c = DataValidation(type="list", formula1='"1,2,3"', allow_blank=True,
                      prompt="Order of priority, Clause 7.1: 1 inherent safety by design; 2 protective measures in the device or in manufacture; 3 information for safety and training. Work 1 before 2 before 3 and record why a higher option was not practicable.",
                      promptTitle="Risk control category")
ws.add_data_validation(dv_c); dv_c.add(f"Q{HA_FIRST}:Q{HA_LAST}")
dv_st = DataValidation(type="list", formula1='"Open,In work,Closed,Superseded"', allow_blank=True)
ws.add_data_validation(dv_st); dv_st.add(f"AA{HA_FIRST}:AA{HA_LAST}")

ws.freeze_panes = "B5"
ws.auto_filter.ref = f"A4:AA{HA_LAST}"
print_setup(ws, NC, rows_repeat="4:4")

# =====================================================================
# Sheet 5: Risk Controls  (Clauses 7.1, 7.2, 7.5)
# =====================================================================
ws = wb.create_sheet("Risk Controls")
RC_COLS = [
    ("A", 9,  "Control\nID"),
    ("B", 12, "Hazard IDs\naddressed"),
    ("C", 44, "The risk control measure\n(Clause 7.1)"),
    ("D", 5,  "Cat"),
    ("E", 38, "Why a higher-priority option was not practicable\n(Clause 7.1 order of priority; MDR Annex I point 4)"),
    ("F", 20, "Requirement or specification it became\n(design input)"),
    ("G", 22, "Verification of IMPLEMENTATION\n(Clause 7.2, first part)"),
    ("H", 22, "Verification of EFFECTIVENESS\n(Clause 7.2, second part)"),
    ("I", 24, "How effectiveness was shown"),
    ("J", 18, "New risks assessed\n(Clause 7.5)"),
    ("K", 9,  "Hazards\nlinked"),
    ("L", 30, "Completeness check\n(formula)"),
    ("M", 14, "Owner"),
    ("N", 11, "Status"),
]
widths(ws, {c: w for c, w, _ in RC_COLS})
title_block(ws, "Risk control traceability",
            "Clause 7.2 requires verification of implementation AND verification of effectiveness. They are two records. A file that has the first and not the second is the most common finding in this clause.")
for i, (_, _, h) in enumerate(RC_COLS, start=1):
    ws.cell(row=4, column=i, value=h)
style_header(ws, 4, len(RC_COLS), height=52)
RC_FIRST = 5

CONTROLS = [
    ("RC-01", "HZ-01", "Non-compliant administration set tubing plus automatic decompression of the line when the pump detects that an occlusion has cleared.", 1,
     "Category 1 applied: the stored-volume mechanism is removed by design rather than warned about.",
     "SRS-114; DWG-2201 rev C", "DHR build record BR-118; design verification DV-114",
     "Design validation DVAL-09; post-change complaint trend CT-2026-008 shows no recurrence over 14 months",
     "Bench measurement of post-occlusion bolus against the 0.1 mL limit, plus field trend",
     "RA-NEW-01 (nuisance alarm rate)", "Closed"),
    ("RC-02", "HZ-02", "Anti-free-flow valve integral to the administration set, closing automatically when the set is removed from the pump.", 1,
     "Category 1 applied: the valve removes the gravity path rather than relying on the user to close a clamp.",
     "SRS-071; ISO 8536 interface spec", "DV-071 leak and closure test; incoming inspection plan IIP-07",
     "Summative usability study US-11: 15 of 15 participants removed the set with no free flow",
     "Usability validation to IEC 62366-1 plus 100% functional test at the supplier",
     "RA-NEW-02 (valve occlusion)", "Closed"),
    ("RC-03", "HZ-03", "Lowered air-in-line detection threshold plus a cumulative-air-volume alarm that triggers below the single-bolus threshold.", 2,
     "Category 1 considered: eliminating air ingress entirely would require a sealed reservoir incompatible with the therapy. Documented in DR-22 section 5.",
     "SRS-022; ALM-003", "DV-022 detector sensitivity test at the specified flow rates",
     "DVAL-04 simulated-use air challenge at 0.5 mL/h and 5 mL/h; alarm triggered in 30 of 30 runs",
     "Instrumented air challenge across the full flow range, not only nominal",
     "RA-NEW-03 (false air alarms)", "Closed"),
    ("RC-04", "HZ-04", "Drug-library hard limits that cannot be overridden, a decimal-separated numeric entry field, and a read-back confirmation screen naming the drug, dose, rate and units.", 2,
     "Category 1 considered: the rate cannot be fixed by design because the therapy is titrated. Documented in URA-11 section 4.",
     "SRS-Ui-33; drug library spec DL-02", "DV-Ui-33 screen and limit test; software unit tests UT-ui",
     "Summative usability study US-09: 0 of 20 participants completed a ten-fold overdose entry",
     "Usability validation to IEC 62366-1 with the ten-fold error as a defined critical task",
     "RA-NEW-04 (limit override workaround)", "In work"),
    ("RC-05", "HZ-05", "Remaining-time indicator computed from measured battery capacity, plus an end-of-service-life indicator that locks out use when measured capacity falls below the specified minimum.", 2,
     "Category 1 considered: mains-only operation would defeat the ambulatory intended use. Documented in BT-208 section 7.",
     "SRS-PWR-08", "DV-PWR-08 gauge accuracy across 0 to 400 cycles",
     "DVAL-12 aged-battery simulated use; predicted versus actual run-down within 10% at 300 cycles",
     "Accuracy measured against actual run-down on aged cells, not on new cells",
     "RA-NEW-05 (premature lockout)", "Closed"),
    ("RC-06", "HZ-06", "Correction of the unit-conversion routine to round half away from zero, with boundary unit tests and an independent code review.", 1,
     "Category 1 applied: the defect is removed from the software rather than warned about in the IFU.",
     "SRS-DOSE-12; SDD 4.3.2", "Code review CR-14; unit test suite UT-dose (100% branch coverage on the routine)",
     "Regression test RT-41 across the weight range at 0.1 kg resolution; two independent reviewers confirmed the output table",
     "Boundary-value testing at every conversion boundary, compared against an independently computed table",
     "RA-NEW-06 (rounding in the opposite direction)", "Closed"),
    ("RC-07", "HZ-07", "Cryptographically signed firmware and drug-library packages, mutual authentication of the update server, and rejection with an audit entry on signature failure.", 1,
     "Category 1 applied: unauthenticated updates are made impossible rather than detected after the fact.",
     "SRS-SEC-04; SBOM-2026-02", "DV-SEC-04 signature verification test; negative tests with tampered packages",
     "Penetration test PT-09 by an independent tester: no accepted unsigned or modified package in 40 attempts",
     "Independent adversarial testing, including downgrade and replay attempts",
     "RA-NEW-07 (failed update leaves stale library)", "In work"),
    ("RC-08", "HZ-08", "Seal strength specification raised to the level the distribution profile demands, 100% visual seal inspection, and package validation to ISO 11607-1 and -2.", 1,
     "Category 1 applied: the barrier is specified to survive distribution rather than relying on the user to spot a breach.",
     "PKG-SPEC-05; IIP-05", "PV-05 seal strength and dye penetration; inspection records IR-05",
     "Accelerated and real-time ageing to the claimed shelf life plus post-distribution testing to ASTM D4169",
     "Sterile barrier integrity after simulated distribution and ageing, not only at release",
     "RA-NEW-08 (over-strong seal defeats aseptic opening)", "Closed"),
    ("RC-09", "HZ-09", "Administration set moulded in a plasticiser-free material, with a biological evaluation and a toxicological risk assessment for the replacement.", 1,
     "Category 1 applied: the substance is removed from the fluid path rather than limiting infusion duration by labelling.",
     "MAT-SPEC-09", "Material certificates MC-09; incoming inspection IIP-09",
     "EL-06 extractables and leachables on the new material with the worst-case drug; TRA-03 concludes exposure below the tolerable intake",
     "Leachables measured with the actual drug over the maximum infusion duration",
     "RA-NEW-09 (new material stiffness affects pumping accuracy)", "Closed"),
    ("RC-10", "HZ-10", "Escalating alarm profile that raises sound pressure level and changes pattern if unacknowledged, plus optional remote caregiver notification.", 2,
     "Category 1 considered: the occlusion itself cannot be designed out of a line that can kink. Documented in HE-02 section 6.",
     "SRS-ALM-10; IEC 60601-1-8 alarm spec", "AT-04 audibility test at the specified distances and levels",
     "DVAL-15 overnight simulated-use study in a domestic noise environment; 18 of 20 sleeping participants woke within 4 minutes",
     "Simulated use in the actual use environment, with sleeping participants rather than a bench measurement",
     "RA-NEW-10 (alarm fatigue and caregiver dependence)", "Closed"),
    ("RC-11", "HZ-11", "Validated cleaning agent list and procedure in the IFU, a compatibility-tested enclosure material, and a label symbol pointing to the cleaning section.", 3,
     "Categories 1 and 2 considered: a fully sealed enclosure was rejected on thermal grounds and a single-patient-use durable was rejected on cost of therapy. Documented in CV-03 section 8. NOTE: cost is not an admissible argument under MDR Annex I point 2, which limits the AFAP obligation only by the benefit-risk ratio. This justification needs rewriting before an EU submission.",
     "IFU-7.3; MAT-SPEC-11", "IFU approval record DOC-2214; label artwork approval LA-118",
     "CV-03 cleaning validation with the listed agents over 200 cycles; MC-11 material compatibility",
     "Validated against the agents actually named in the IFU, over the claimed service life",
     "RA-NEW-11 (unlisted agent used anyway)", "Open"),
    ("RC-12", "HZ-12", "Patient connector changed to a design that is dimensionally incompatible with enteral ports, conforming to the applicable part of ISO 80369.", 1,
     "Category 1 applied: the misconnection is made physically impossible rather than labelled against.",
     "SRS-CON-12", "CC-02 connector conformance test; gauge inspection records GI-12",
     "Misconnection challenge test: no successful connection to an enteral port in 50 attempts by 10 clinicians",
     "Physical challenge testing by clinicians, not dimensional inspection alone",
     "RA-NEW-12 (transition-period mixed inventory)", "Closed"),
    ("RC-13", "HZ-13", "Storage temperature range on the carton and device label, and a power-on self-test message that names the fault and directs the user to allow the device to equilibrate.", 3,
     "Categories 1 and 2 considered: widening the component temperature range was assessed as not achievable within the device's size and weight requirements. Documented in ET-07 section 9.",
     "LBL-13; SRS-POST-13", "Label artwork approval LA-121; DV-POST-13 self-test message test",
     "DVAL-18: 19 of 20 participants correctly interpreted the message and waited; the IFU wording was revised after the twentieth",
     "Comprehension tested with users, not assumed from the wording",
     "RA-NEW-13 (user waits but does not re-check)", "Closed"),
    ("RC-14", "HZ-14", "A cytotoxic-waste container supplied with each prescription, plus an IFU section and a pictogram covering disposal of the used set.", 2,
     "Category 1 considered: eliminating residual volume entirely is bounded by the set's priming volume. Documented in RV-01 section 4.",
     "KIT-BOM-14; IFU-9", "Kit content verification KV-14; IFU approval DOC-2219",
     "DVAL-20 home-use study: 17 of 20 carers used the supplied container correctly; IFU revised and re-tested to 20 of 20",
     "Observed disposal behaviour in the home, re-tested after the IFU revision",
     "RA-NEW-14 (container not returned or refilled)", "In work"),
    ("RC-16", "HZ-16", "Warning added to IFU section 6 telling the user not to silence the alarm without checking the line.", 3,
     "",
     "", "IFU approval record DOC-2230",
     "", "",
     "", "Closed"),
]

RC_TOTAL = 30
r = RC_FIRST
for idx in range(RC_TOTAL):
    d = CONTROLS[idx] if idx < len(CONTROLS) else None
    if d:
        cid, hz, meas, cat, just, req, voi, voe, how, newr, st = d
        for col, v in ((1, cid), (2, hz), (3, meas), (4, cat), (5, just),
                       (6, req), (7, voi), (8, voe), (9, how), (10, newr), (14, st)):
            ws.cell(row=r, column=col, value=v)
    ws.cell(row=r, column=11, value=f"=IF($A{r}=\"\",\"\",COUNTIF('Hazard Analysis'!$P:$P,$A{r}))")
    ws.cell(row=r, column=12, value=(
        f'=IF($A{r}="","",'
        f'IF($D{r}="","Category missing",'
        f'IF(AND($D{r}>1,$E{r}=""),"Order-of-priority justification missing",'
        f'IF($F{r}="","Requirement reference missing",'
        f'IF($G{r}="","Implementation not verified",'
        f'IF($H{r}="","Effectiveness not verified",'
        f'IF($I{r}="","Effectiveness method not stated",'
        f'IF($J{r}="","New risks not assessed (Clause 7.5)",'
        f'IF($K{r}=0,"Orphan - no hazard row cites it","Complete")))))))))'))
    body(ws, r, len(RC_COLS), fill=TINT2 if idx % 2 else None,
         height=max(28, 10.5 * (1 + len(d[2]) // 46)) if d else 22, size=8.5)
    ws.cell(row=r, column=1).font = Font(name=FONT, size=8.5, bold=True, color=NAVY)
    for c in (4, 11):
        ws.cell(row=r, column=c).alignment = Alignment(horizontal="center", vertical="top")
    ws.cell(row=r, column=12).font = Font(name=FONT, size=8, bold=True)
    inputs(ws, r, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 14])
    r += 1
RC_LAST = r - 1

dv_c2 = DataValidation(type="list", formula1='"1,2,3"', allow_blank=True,
                       prompt="1 inherent safety by design; 2 protective measures in the device itself or in manufacture; 3 information for safety and training. Clause 7.1 requires this order, and requires you to record why a higher option was not practicable.",
                       promptTitle="Order of priority")
ws.add_data_validation(dv_c2); dv_c2.add(f"D{RC_FIRST}:D{RC_LAST}")
dv_st2 = DataValidation(type="list", formula1='"Open,In work,Closed,Superseded"', allow_blank=True)
ws.add_data_validation(dv_st2); dv_st2.add(f"N{RC_FIRST}:N{RC_LAST}")
ws.freeze_panes = "B5"
ws.auto_filter.ref = f"A4:N{RC_LAST}"
print_setup(ws, len(RC_COLS), rows_repeat="4:4")

HA = "'Hazard Analysis'"
RCS = "'Risk Controls'"
HAR = f"{HA}!$A${HA_FIRST}:$A${HA_LAST}"

# =====================================================================
# Sheet 6: Residual Risk  (Clause 8, overall residual risk)
# =====================================================================
ws = wb.create_sheet("Residual Risk")
widths(ws, {"A": 6, "B": 46, "C": 56, "D": 30, "E": 14})
title_block(ws, "Residual risk and overall residual risk",
            "Clause 8 requires an evaluation of the OVERALL residual risk, using the method and criteria the plan declared. It is not the sum of the individual residual risks, and it is not satisfied by a table of green cells.")

r = 4
ws.cell(row=r, column=1, value="Individual residual risks (from 'Hazard Analysis')").font = Font(name=FONT, bold=True, size=11, color=NAVY)
r += 1
for i, h in enumerate(["", "Measure", "Count", "Where it comes from"], start=1):
    ws.cell(row=r, column=i, value=h)
style_header(ws, r, 4, height=20)
r += 1
METRICS = [
    ("Hazardous situations analysed", f"=COUNTA({HAR})", "Column A"),
    ("Initial risks evaluated Not acceptable", f'=COUNTIF({HA}!$M${HA_FIRST}:$M${HA_LAST},"Not acceptable*")', "Column M"),
    ("Residual risks evaluated Acceptable", f'=COUNTIF({HA}!$V${HA_FIRST}:$V${HA_LAST},"Acceptable*")', "Column V"),
    ("Residual risks still Not acceptable", f'=COUNTIF({HA}!$V${HA_FIRST}:$V${HA_LAST},"Not acceptable*")', "Column V - each needs a benefit-risk record"),
    ("Residual risks not yet estimated", f'=COUNTIFS({HAR},"<>",{HA}!$P${HA_FIRST}:$P${HA_LAST},"<>",{HA}!$R${HA_FIRST}:$R${HA_LAST},"")', "Controlled rows with no residual estimate"),
    ("Risks evaluated on severity alone (probability not estimable)", f'=COUNTIF({HA}!$V${HA_FIRST}:$V${HA_LAST},"*S only*")', "Clause 4.4 d) case"),
    ("Rows whose completeness check is not Complete", f'=COUNTIFS({HAR},"<>",{HA}!$X${HA_FIRST}:$X${HA_LAST},"<>Complete")', "Column X"),
    ("Risk controls relying on information for safety (category 3)", f'=COUNTIF({HA}!$Q${HA_FIRST}:$Q${HA_LAST},3)', "The weakest option; each needs an order-of-priority justification"),
    ("Risk controls that introduced a new risk", f'=COUNTIF({HA}!$Y${HA_FIRST}:$Y${HA_LAST},"Y*")', "Clause 7.5 - any new or increased risk is managed under 5.5 to 7.4, so it needs its own row"),
]
res_first = r
for i, (lab, f, src) in enumerate(METRICS):
    ws.cell(row=r, column=2, value=lab)
    ws.cell(row=r, column=3, value=f)
    ws.cell(row=r, column=4, value=src)
    body(ws, r, 4, fill=TINT2 if i % 2 else None, height=22)
    ws.cell(row=r, column=2).font = Font(name=FONT, size=9)
    ws.cell(row=r, column=3).font = Font(name=FONT, size=11, bold=True, color=NAVY)
    ws.cell(row=r, column=3).alignment = Alignment(horizontal="center", vertical="center")
    ws.cell(row=r, column=4).font = Font(name=FONT, size=8, italic=True, color=GREY)
    r += 1
r += 1

ws.cell(row=r, column=1, value="Overall residual risk evaluation (Clause 8)").font = Font(name=FONT, bold=True, size=11, color=NAVY)
r += 1
ws.cell(row=r, column=1, value="Each input below has to be considered and the consideration recorded. A conclusion with no inputs is the finding.").font = Font(name=FONT, size=9, italic=True, color=GREY)
r += 1
for i, h in enumerate(["#", "Input to the overall evaluation", "What the evaluation has to say about it", "Your record or conclusion", "Considered?"], start=1):
    ws.cell(row=r, column=i, value=h)
style_header(ws, r, 5, height=32)
OVERALL = [
    ("The combination of individual residual risks",
     "Several individually acceptable residual risks may be unacceptable together, particularly where they share a cause or affect the same patient episode."),
    ("Risks arising from a single common cause",
     "Where one failure produces several hazardous situations at once, the combined exposure is what the patient experiences. Name the common causes you looked for."),
    ("Conflicting requirements between risk controls",
     "A control added for one risk can defeat another. Alarm loudness against alarm fatigue; a stiffer set against pumping accuracy. Name the conflicts and how they were resolved."),
    ("The number and nature of warnings and instructions relied on",
     "Information for safety is the weakest control. A device whose safety rests on many warnings has a higher overall residual risk than the individual rows suggest. Count them."),
    ("Comparison with similar devices on the market and the state of the art",
     "MDR Annex I points 1 and 4 both require the generally acknowledged state of the art to be taken into account. Name the comparators and the sources."),
    ("The clinical benefit and the benefit-risk conclusion",
     "Clause 8 asks whether the overall residual risk is outweighed by the benefit. Reference the 'Benefit-Risk' sheet rather than repeating it."),
    ("Information from production and post-production",
     "For a device already on the market, the Clause 10 information is an input to the overall evaluation, not a separate exercise. Reference the 'Prod & Post-Prod' sheet."),
    ("Disclosure of significant residual risks",
     "Clause 8 requires significant residual risks to be disclosed in the accompanying information. List what is disclosed and where."),
    ("The conclusion, against the criteria the plan declared",
     "State the criteria, then the conclusion, then who has the authority to sign it. If the conclusion is that the overall residual risk is not acceptable, the device does not ship."),
]
ov_first = r + 1
for i, (inp, guide) in enumerate(OVERALL, start=1):
    r += 1
    ws.cell(row=r, column=1, value=i)
    ws.cell(row=r, column=2, value=inp)
    ws.cell(row=r, column=3, value=guide)
    body(ws, r, 5, fill=TINT2 if i % 2 else None, height=max(28, 11 * (1 + len(guide) // 64)))
    ws.cell(row=r, column=1).font = Font(name=FONT, size=9, bold=True, color=GOLD)
    ws.cell(row=r, column=1).alignment = Alignment(horizontal="center", vertical="top")
    ws.cell(row=r, column=2).font = Font(name=FONT, size=9, bold=True)
    inputs(ws, r, [4, 5])
ov_last = r
dv_yn = DataValidation(type="list", formula1='"Yes,No,N/A"', allow_blank=True)
ws.add_data_validation(dv_yn); dv_yn.add(f"E{ov_first}:E{ov_last}")
r += 2
ws.cell(row=r, column=2, value="Inputs recorded as considered").font = Font(name=FONT, bold=True, size=10, color=NAVY)
ws.cell(row=r, column=3, value=f'=COUNTIF($E${ov_first}:$E${ov_last},"Yes")')
ws.cell(row=r, column=3).font = Font(name=FONT, bold=True, size=11, color=NAVY)
ws.cell(row=r, column=3).alignment = Alignment(horizontal="center")
ws.cell(row=r, column=4, value=f"of {len(OVERALL)} inputs").font = Font(name=FONT, size=9, italic=True, color=GREY)
OV_DONE_COUNT = f"'Residual Risk'!$C${r}"
OV_N = len(OVERALL)
r += 1
ws.cell(row=r, column=2, value="Overall residual risk conclusion").font = Font(name=FONT, bold=True, size=10, color=NAVY)
OV_CONCLUSION = f"'Residual Risk'!$C${r}"
inputs(ws, r, [3, 4, 5])
ws.cell(row=r, column=3).border = BOX; ws.cell(row=r, column=4).border = BOX; ws.cell(row=r, column=5).border = BOX
dv_ov = DataValidation(type="list", formula1='"Acceptable,Acceptable on benefit-risk grounds,Not acceptable"', allow_blank=True)
ws.add_data_validation(dv_ov); dv_ov.add(f"C{r}")
r += 1
ws.cell(row=r, column=2, value="Approved by, role and date").font = Font(name=FONT, bold=True, size=10, color=NAVY)
inputs(ws, r, [3, 4, 5])
for c in (3, 4, 5):
    ws.cell(row=r, column=c).border = BOX
ws.sheet_view.showGridLines = False
print_setup(ws, 5, landscape=False)

# =====================================================================
# Sheet 7: Benefit-Risk  (Clause 7.4 per risk; Clause 8 overall)
# =====================================================================
ws = wb.create_sheet("Benefit-Risk")
BR_COLS = [
    ("A", 10, "Hazard ID\n(or OVERALL)"),
    ("B", 34, "Residual risk being weighed"),
    ("C", 34, "Why further risk control is not practicable\n(Clause 7.4; AFAP under MDR Annex I point 2)"),
    ("D", 26, "Clinical benefit: nature"),
    ("E", 20, "Magnitude"),
    ("F", 20, "Probability the patient experiences it"),
    ("G", 18, "Duration"),
    ("H", 22, "Clinical evidence\n(record reference)"),
    ("I", 28, "State of the art and alternatives available to the patient"),
    ("J", 16, "Conclusion"),
    ("K", 22, "Approved by, role, date"),
    ("L", 26, "Check (formula)"),
]
widths(ws, {c: w for c, w, _ in BR_COLS})
title_block(ws, "Benefit-risk records",
            "One row per residual risk the criteria do not accept and that cannot be reduced further (Clause 7.4), plus one OVERALL row (Clause 8). MDR Annex I points 1 and 8 require the risks to be acceptable when weighed against the benefits, and Annex II point 5(a) requires that benefit-risk analysis in the technical documentation; a benefit stated without magnitude, probability and duration is not weighable.")
for i, (_, _, h) in enumerate(BR_COLS, start=1):
    ws.cell(row=4, column=i, value=h)
style_header(ws, 4, len(BR_COLS), height=48)
BR_FIRST = 5
BR_TOTAL = 12
r = BR_FIRST
BEN_M = "Substantial: the therapy is life-sustaining for the indicated population."
BEN_P = "High: 92% of patients in CLIN-04 completed the prescribed course at home."
BEN_D = "Duration of therapy, typically 6 to 18 months."
BEN_N = "Enables continuous ambulatory infusion of the prescribed therapy outside hospital, which the alternative (inpatient infusion) does not."
APPR = "Dr L. Baptiste, Medical Director, 2026-08-14"

EX = [
    ("HZ-02", "Residual risk of uncontrolled gravity infusion stays Not acceptable on the example criteria: severity remains 5, and once free flow has started the conditional probability of harm is almost certain.",
     "The anti-free-flow valve is integral to the set and closes automatically on removal. No further inherent-safety or protective measure was identified that does not also prevent the set from being loaded. Documented in RA-BR-02.",
     BEN_N, BEN_M, BEN_P, BEN_D, "CLIN-04 clinical evaluation report; CER rev 6 section 9.",
     "An integral anti-free-flow valve is the generally acknowledged state of the art. No marketed alternative eliminates the gravity path entirely.",
     "Benefit outweighs", APPR),
    ("HZ-03", "Residual risk of air embolism stays Not acceptable on the example criteria: severity remains 5. The lowered threshold and cumulative-volume alarm reduce P1 but cannot reach zero.",
     "The detection threshold is at the limit of the sensing technology qualified for this flow range, and a sealed reservoir was rejected as incompatible with the therapy. Documented in DR-22 section 5 and RA-BR-03.",
     BEN_N, BEN_M, BEN_P, BEN_D, "CLIN-04; CER rev 6 section 9; DR-22.",
     "Cumulative air-volume alarming below the single-bolus threshold exceeds the alarm behaviour of the comparator devices surveyed in CER rev 6 section 8.",
     "Benefit outweighs", APPR),
    ("HZ-07", "Residual risk from a compromised drug-library update stays Not acceptable on the example criteria: severity remains 5 because the consequence is fleet-wide loss of dose limits.",
     "Signed packages and mutual authentication are the strongest available inherent-safety measures. Removing the wireless update path entirely was assessed and rejected: it would force manual library updates, whose error rate is higher. Documented in TM-03 section 9 and RA-BR-07.",
     BEN_N, BEN_M, BEN_P, BEN_D, "CLIN-04; PT-09 penetration test report; MDCG 2019-16 gap review.",
     "Signed firmware and library packages with mutual authentication is the state of the art for connected infusion devices; the comparator survey in TM-03 found two of five comparators without it.",
     "Benefit outweighs", APPR),
    ("HZ-12", "Residual risk of wrong-route administration remains Not acceptable on the example criteria because severity stays at 5 and the conditional probability of harm, once a misconnection is made, stays at 5.",
     "The connector already conforms to the applicable part of ISO 80369 and is dimensionally incompatible with enteral ports. No further design or protective measure was identified that does not defeat the intended use. Documented in RA-BR-12.",
     "Enables continuous ambulatory infusion of the prescribed therapy outside hospital, which the alternative (inpatient infusion) does not.",
     "Substantial: the therapy is life-sustaining for the indicated population.",
     "High: 92% of patients in CLIN-04 completed the prescribed course at home.",
     "Duration of therapy, typically 6 to 18 months.",
     "CLIN-04 clinical evaluation report; CER rev 6 section 9.",
     "No marketed alternative provides ambulatory delivery of this therapy with a lower wrong-route residual risk; ISO 80369 conformance is the state of the art.",
     "Benefit outweighs", APPR),
    ("OVERALL", "Overall residual risk of the device, evaluated on the 'Residual Risk' sheet against the criteria the plan declared.",
     "", BEN_N, BEN_M, BEN_P, BEN_D, "CLIN-04; CER rev 6; PMS-2026-Q1.",
     "Comparator survey in CER rev 6 section 8; the device is at or above the state of the art on every hazard class assessed.", "", ""),
]
for idx in range(BR_TOTAL):
    d = EX[idx] if idx < len(EX) else None
    if d:
        for col, v in enumerate(d, start=1):
            if v != "":
                ws.cell(row=r, column=col, value=v)
    ws.cell(row=r, column=12, value=(
        f'=IF($A{r}="","",'
        f'IF(AND($A{r}<>"OVERALL",COUNTIF({HAR},$A{r})=0),"Hazard ID not in Hazard Analysis",'
        f'IF(AND($A{r}<>"OVERALL",$C{r}=""),"No justification that control is impracticable",'
        f'IF(OR($E{r}="",$F{r}="",$G{r}=""),"Benefit not characterised (magnitude, probability, duration)",'
        f'IF($H{r}="","No clinical evidence cited",'
        f'IF($I{r}="","State of the art not addressed",'
        f'IF($J{r}="","No conclusion",'
        f'IF($K{r}="","Not approved","Complete"))))))))'))
    body(ws, r, len(BR_COLS), fill=TINT2 if idx % 2 else None,
         height=max(30, 11 * (1 + len(d[1]) // 36)) if d else 26, size=8.5)
    ws.cell(row=r, column=1).font = Font(name=FONT, size=8.5, bold=True, color=NAVY)
    ws.cell(row=r, column=12).font = Font(name=FONT, size=8, bold=True)
    inputs(ws, r, list(range(1, 12)))
    r += 1
BR_LAST = r - 1
dv_br = DataValidation(type="list", formula1='"Benefit outweighs,Benefit does not outweigh,Undetermined"', allow_blank=True)
ws.add_data_validation(dv_br); dv_br.add(f"J{BR_FIRST}:J{BR_LAST}")
ws.freeze_panes = "B5"
print_setup(ws, len(BR_COLS), rows_repeat="4:4")

# =====================================================================
# Sheet 8: Prod & Post-Prod  (Clause 10)
# =====================================================================
ws = wb.create_sheet("Prod & Post-Prod")
PP_COLS = [
    ("A", 9,  "Ref"),
    ("B", 11, "Date\nreceived"),
    ("C", 20, "Information source\n(Clause 10.1)"),
    ("D", 40, "What the information said"),
    ("E", 8,  "Safety\nrelevant?"),
    ("F", 9,  "New\nhazard?"),
    ("G", 10, "Risk no\nlonger acc?"),
    ("H", 10, "Estimate\ninvalid?"),
    ("I", 9,  "SOTA\nchanged?"),
    ("J", 34, "Action taken"),
    ("K", 14, "Hazard rows\nupdated"),
    ("L", 10, "RM file\nrev"),
    ("M", 20, "PMS, PSUR or\nvigilance link"),
    ("N", 14, "Owner"),
    ("O", 11, "Due"),
    ("P", 11, "Closed"),
    ("Q", 8,  "Days\nopen"),
    ("R", 28, "Check (formula)"),
    ("S", 11, "Status"),
]
widths(ws, {c: w for c, w, _ in PP_COLS})
title_block(ws, "Production and post-production information",
            "Clause 10. This is the sheet that makes the file a living document, and the sheet auditors find empty. Clause 10.3 asks four questions of every safety-relevant item; columns F to I are those questions.")
for i, (_, _, h) in enumerate(PP_COLS, start=1):
    ws.cell(row=4, column=i, value=h)
style_header(ws, 4, len(PP_COLS), height=44)
PP_FIRST = 5
PPEX = [
    ("PP-001", date(2026, 3, 4), "Complaint", "Three complaints in eight weeks describing a bolus on clearance of a downstream occlusion. Two patients required observation; no permanent harm.",
     "Y", "N", "Y", "Y", "N",
     "Risk file reopened. P1 for HZ-01 re-estimated from 3 to 4 on the complaint rate. Design change raised (RC-01). Trend reported under MDR Article 88 assessment TR-2026-006.",
     "HZ-01", "rev 7", "PMS-2026-Q1; TR-2026-006", "K. Osei", date(2026, 4, 15), date(2026, 6, 30), "Closed"),
    ("PP-002", date(2026, 5, 19), "Literature", "Published case series reports air embolism at bubble volumes below the sensitivity threshold assumed in the original analysis for low flow rates.",
     "Y", "N", "N", "Y", "Y",
     "Original P2 for HZ-03 was based on a threshold no longer supported by the literature. Estimate revised and RC-03 threshold lowered. State of the art assessment updated in CER rev 6.",
     "HZ-03", "rev 7", "CER rev 6 section 7", "M. Duarte", date(2026, 7, 1), date(2026, 8, 22), "Closed"),
    ("PP-003", date(2026, 7, 8), "Similar device data", "Competitor field safety notice on unauthenticated drug-library updates; same architecture class as our wireless update path.",
     "Y", "Y", "Y", "N", "Y",
     "Previously unrecognised hazardous situation for our device. New row HZ-07 opened; threat model TM-03 and RC-07 raised. Not yet closed.",
     "HZ-07", "rev 8 draft", "FSN reference; MDCG 2019-16 review", "A. Whitfield", date(2026, 10, 31), "", "In work"),
    ("PP-004", date(2026, 8, 25), "Production nonconformity", "Seal strength on three pouch lots measured below specification at incoming inspection; no product released.",
     "Y", "N", "N", "N", "N",
     "No change to the risk estimate: the control worked as designed and the nonconforming product was detained. Recorded as evidence that RC-08 is effective in production.",
     "HZ-08", "no change", "NCR-2026-114; CAPA-2026-031", "R. Iyer", date(2026, 9, 30), date(2026, 9, 12), "Closed"),
    ("PP-005", date(2026, 9, 2), "Service and maintenance", "Four returned pumps show battery capacity below the lockout threshold without the end-of-service indicator having triggered.",
     "Y", "N", "N", "Y", "N",
     "Under assessment. If the indicator did not trigger, RC-05's effectiveness verification does not hold and the residual estimate for HZ-05 is not supported.",
     "", "", "SVC-2026-088", "K. Osei", date(2026, 10, 10), "", "Open"),
]
r = PP_FIRST
PP_TOTAL = 30
for idx in range(PP_TOTAL):
    d = PPEX[idx] if idx < len(PPEX) else None
    if d:
        # the tuple's last element is Status, which lives in column 19 (S);
        # columns 17 and 18 carry formulas, so the first 16 map straight across
        for col, v in enumerate(d[:16], start=1):
            if v != "":
                ws.cell(row=r, column=col, value=v)
        ws.cell(row=r, column=19, value=d[16])
    ws.cell(row=r, column=17, value=f'=IF($B{r}="","",IF($P{r}<>"",$P{r}-$B{r},TODAY()-$B{r}))')
    ws.cell(row=r, column=18, value=(
        f'=IF($A{r}="","",'
        f'IF($E{r}="","Safety relevance not assessed",'
        f'IF(AND($E{r}="Y",OR($F{r}="",$G{r}="",$H{r}="",$I{r}="")),"Clause 10.3 questions incomplete",'
        f'IF(AND($E{r}="Y",$J{r}=""),"No action recorded",'
        f'IF(AND(OR($F{r}="Y",$G{r}="Y",$H{r}="Y",$I{r}="Y"),$K{r}=""),"Risk file rows not updated",'
        f'IF(AND(OR($F{r}="Y",$G{r}="Y",$H{r}="Y",$I{r}="Y"),$L{r}=""),"RM file revision not recorded",'
        f'IF(AND($S{r}="Closed",$P{r}=""),"Closed with no closure date",'
        f'IF(AND($S{r}<>"Closed",$O{r}<>"",$O{r}<TODAY()),"OVERDUE","OK"))))))))'))
    body(ws, r, len(PP_COLS), fill=TINT2 if idx % 2 else None,
         height=max(28, 11 * (1 + len(d[3]) // 42)) if d else 22, size=8.5)
    ws.cell(row=r, column=1).font = Font(name=FONT, size=8.5, bold=True, color=NAVY)
    for c in (2, 15, 16):
        ws.cell(row=r, column=c).number_format = "yyyy-mm-dd"
    for c in (5, 6, 7, 8, 9, 17):
        ws.cell(row=r, column=c).alignment = Alignment(horizontal="center", vertical="top")
    ws.cell(row=r, column=18).font = Font(name=FONT, size=8, bold=True)
    inputs(ws, r, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 19])
    r += 1
PP_LAST = r - 1
dv_src = DataValidation(type="list", allow_blank=True, formula1=(
    '"Complaint,Vigilance or serious incident,Field safety corrective action,PMS data,PMCF,'
    'Literature,Similar device data,Trend analysis,Internal audit,Service and maintenance,'
    'Production nonconformity,Supplier information,User feedback,Regulatory or standard change"'))
ws.add_data_validation(dv_src); dv_src.add(f"C{PP_FIRST}:C{PP_LAST}")
dv_yn2 = DataValidation(type="list", formula1='"Y,N"', allow_blank=True)
ws.add_data_validation(dv_yn2)
for col in ("E", "F", "G", "H", "I"):
    dv_yn2.add(f"{col}{PP_FIRST}:{col}{PP_LAST}")
dv_st3 = DataValidation(type="list", formula1='"Open,In work,Closed"', allow_blank=True)
ws.add_data_validation(dv_st3); dv_st3.add(f"S{PP_FIRST}:S{PP_LAST}")
ws.freeze_panes = "B5"
ws.auto_filter.ref = f"A4:S{PP_LAST}"
print_setup(ws, len(PP_COLS), rows_repeat="4:4")

# =====================================================================
# Sheet 9: RM File Index  (Clause 4.5)
# =====================================================================
ws = wb.create_sheet("RM File Index")
widths(ws, {"A": 6, "B": 38, "C": 13, "D": 20, "E": 7, "F": 26, "G": 10, "H": 34})
title_block(ws, "Risk management file index",
            "Clause 4.5 requires the risk management file to provide traceability for each identified hazard to the risk analysis, the risk evaluation, the risk control measures and the assessment of the acceptability of any residual risk. The file may be a set of references; this is the index that makes it one.")
for i, h in enumerate(["#", "Record the file must provide", "Clause", "Document ID", "Rev", "Where it lives", "Present?", "Note"], start=1):
    ws.cell(row=4, column=i, value=h)
style_header(ws, 4, 8, height=32)
INDEX_ROWS = [
    ("Risk management plan, at its current revision", "4.4"),
    ("Records of changes to the plan", "4.4"),
    ("Competence records for the persons performing risk management tasks", "4.3"),
    ("Intended use and reasonably foreseeable misuse", "5.2"),
    ("Characteristics related to safety", "5.3"),
    ("Identification of hazards and hazardous situations, with the sequences of events", "5.4"),
    ("Risk estimation for each hazardous situation, with the basis for each estimate", "5.5"),
    ("Risk evaluation against the criteria in the plan", "6"),
    ("Risk control option analysis, in the order of priority", "7.1"),
    ("Residual risk evaluation for each individual residual risk", "7.3"),
    ("Verification of implementation of each risk control measure", "7.2"),
    ("Verification of effectiveness of each risk control measure", "7.2"),
    ("Assessment of risks arising from the risk control measures themselves", "7.5"),
    ("Completeness of risk control: every identified hazardous situation considered", "7.6"),
    ("Benefit-risk analysis for residual risks the criteria do not accept", "7.4"),
    ("Evaluation of overall residual risk and its acceptability", "8"),
    ("Disclosure of significant residual risks in the accompanying information", "8"),
    ("Risk management review and the risk management report", "9"),
    ("Procedure and records for collecting production and post-production information", "10.1, 10.2"),
    ("Review of that information for safety relevance and the four Clause 10.3 questions", "10.3"),
    ("Actions taken where the information affected the risk file", "10.4"),
    ("Traceability from each hazard through to residual risk acceptability", "4.5"),
    ("Link to the post-market surveillance plan (MDR Annex III)", "MDR"),
    ("Link to the post-market clinical follow-up plan (MDR Annex XIV Part B)", "MDR"),
    ("Link to the clinical evaluation and the benefit-risk determination (MDR Annex I point 1)", "MDR"),
    ("Statement of how risks are reduced as far as possible (MDR Annex I point 4 order of priority, read with the point 2 definition)", "MDR"),
    ("Link to the usability engineering file (IEC 62366-1)", "Related"),
    ("Link to the software safety classification and software risk records (IEC 62304)", "Related"),
    ("Link to the biological evaluation (ISO 10993-1)", "Related"),
    ("Link to the security risk records for a connected device", "Related"),
]
r = 5
for i, (rec, cl) in enumerate(INDEX_ROWS, start=1):
    ws.cell(row=r, column=1, value=i)
    ws.cell(row=r, column=2, value=rec)
    ws.cell(row=r, column=3, value=cl)
    body(ws, r, 8, fill=TINT2 if i % 2 else None, height=max(22, 11 * (1 + len(rec) // 46)))
    ws.cell(row=r, column=1).font = Font(name=FONT, size=8.5, bold=True, color=GOLD)
    ws.cell(row=r, column=1).alignment = Alignment(horizontal="center", vertical="top")
    ws.cell(row=r, column=3).font = Font(name=FONT, size=8.5, bold=True, color=NAVY)
    ws.cell(row=r, column=3).alignment = Alignment(horizontal="center", vertical="top")
    inputs(ws, r, [4, 5, 6, 7, 8])
    r += 1
IX_FIRST, IX_LAST = 5, r - 1
dv_p = DataValidation(type="list", formula1='"Yes,Partial,No,N/A"', allow_blank=True)
ws.add_data_validation(dv_p); dv_p.add(f"G{IX_FIRST}:G{IX_LAST}")
r += 1
ws.cell(row=r, column=2, value="Index completeness").font = Font(name=FONT, bold=True, size=10, color=NAVY)
ws.cell(row=r, column=4, value=(
    f'=IF(COUNTA($G${IX_FIRST}:$G${IX_LAST})=0,"Not started",'
    f'COUNTIF($G${IX_FIRST}:$G${IX_LAST},"Yes") & " of " & '
    f'(COUNTA($G${IX_FIRST}:$G${IX_LAST})-COUNTIF($G${IX_FIRST}:$G${IX_LAST},"N/A")) & " applicable records present")'))
ws.cell(row=r, column=4).font = Font(name=FONT, bold=True, size=10, color=NAVY)
IX_DONE_ROW = r
ws.merge_cells(start_row=r, start_column=4, end_row=r, end_column=8)
ws.freeze_panes = "A5"
print_setup(ws, 8, rows_repeat="4:4", landscape=False)

# =====================================================================
# Sheet 10: Dashboard
# =====================================================================
ws = wb.create_sheet("Dashboard")
widths(ws, {"A": 56, "B": 24, "C": 62})
title_block(ws, "Risk file readiness dashboard",
            "Every figure is a formula over the other sheets. Nothing here is typed in.")
PPR = f"'Prod & Post-Prod'"
BRR = f"'Benefit-Risk'"

ROW_OF = {}

def blk(title, rows, r):
    ws.cell(row=r, column=1, value=title).font = Font(name=FONT, bold=True, size=11, color=NAVY)
    r += 1
    for i, h in enumerate(["Measure", "Value", "What it means"], start=1):
        ws.cell(row=r, column=i, value=h)
    style_header(ws, r, 3, height=18)
    r += 1
    for i, (lab, f, note) in enumerate(rows):
        ROW_OF[lab] = r
        ws.cell(row=r, column=1, value=lab)
        ws.cell(row=r, column=2, value=f)
        ws.cell(row=r, column=3, value=note)
        body(ws, r, 3, fill=TINT2 if i % 2 else None, height=max(20, 11 * (1 + len(note) // 72)))
        ws.cell(row=r, column=1).font = Font(name=FONT, size=9)
        ws.cell(row=r, column=2).font = Font(name=FONT, size=11, bold=True, color=NAVY)
        ws.cell(row=r, column=2).alignment = Alignment(horizontal="center", vertical="center")
        ws.cell(row=r, column=3).font = Font(name=FONT, size=8.5, italic=True, color=GREY)
        r += 1
    return r + 1

r = 4
r = blk("Analysis", [
    ("Hazardous situations analysed", f"=COUNTA({HAR})",
     "Clause 5.4. One row per hazardous situation. A file with fewer rows than the device has failure modes has collapsed the analysis."),
    ("Rows with no MDR GSPR link", f'=COUNTIFS({HAR},"<>",{HA}!$G${HA_FIRST}:$G${HA_LAST},"")',
     "Annex I Chapter I has to be addressed requirement by requirement. An unlinked row cannot be defended in a technical documentation assessment."),
    ("Rows with no stated basis for the probability estimate", f'=COUNTIFS({HAR},"<>",{HA}!$K${HA_FIRST}:$K${HA_LAST},"")',
     "The first question a reviewer asks about a number is where it came from."),
    ("Rows evaluated on severity alone", f'=COUNTIF({HA}!$M${HA_FIRST}:$M${HA_LAST},"*S only*")',
     "Clause 4.4 d) permits this, but only against a rule the plan declared in advance."),
], r)

r = blk("Risk control", [
    ("Initial risks the criteria do not accept", f'=COUNTIF({HA}!$M${HA_FIRST}:$M${HA_LAST},"Not acceptable*")',
     "Each one needs a risk control measure under Clause 7.1."),
    ("...of which no risk control is recorded", f'=COUNTIFS({HA}!$M${HA_FIRST}:$M${HA_LAST},"Not acceptable*",{HA}!$P${HA_FIRST}:$P${HA_LAST},"")',
     "Must be zero before the risk management report is signed."),
    ("Controls relying on information for safety (category 3)", f'=COUNTIF({HA}!$Q${HA_FIRST}:$Q${HA_LAST},3)',
     "The weakest option in the Clause 7.1 order of priority. Each needs a record of why 1 and 2 were not practicable."),
    ("Category 2 or 3 controls with no order-of-priority justification", f'=COUNTIFS({RCS}!$D${RC_FIRST}:$D${RC_LAST},">1",{RCS}!$E${RC_FIRST}:$E${RC_LAST},"")',
     "MDR Annex I point 4 makes the order mandatory, not advisory."),
    ("Controls with implementation not verified", f'=COUNTIFS({RCS}!$A${RC_FIRST}:$A${RC_LAST},"<>",{RCS}!$G${RC_FIRST}:$G${RC_LAST},"")',
     "Clause 7.2, first part."),
    ("Controls with EFFECTIVENESS not verified", f'=COUNTIFS({RCS}!$A${RC_FIRST}:$A${RC_LAST},"<>",{RCS}!$H${RC_FIRST}:$H${RC_LAST},"")',
     "Clause 7.2, second part. This is the count that most often is not zero."),
    ("Controls with no assessment of the risks they introduce", f'=COUNTIFS({RCS}!$A${RC_FIRST}:$A${RC_LAST},"<>",{RCS}!$J${RC_FIRST}:$J${RC_LAST},"")',
     "Clause 7.5. A control that creates a new hazardous situation, or raises an existing risk, needs its own row in the analysis."),
    ("Orphan controls: no hazard row cites them", f'=COUNTIFS({RCS}!$A${RC_FIRST}:$A${RC_LAST},"<>",{RCS}!$K${RC_FIRST}:$K${RC_LAST},0)',
     "Traceability runs both ways under Clause 4.5."),
], r)

r = blk("Residual risk and benefit-risk", [
    ("Residual risks the criteria do not accept", f'=COUNTIF({HA}!$V${HA_FIRST}:$V${HA_LAST},"Not acceptable*")',
     "Clause 7.4: further control, or a benefit-risk analysis."),
    ("...with no benefit-risk record", f'=SUMPRODUCT(({HA}!$V${HA_FIRST}:$V${HA_LAST}<>"")*(LEFT({HA}!$V${HA_FIRST}:$V${HA_LAST},3)="Not")*(COUNTIF({BRR}!$A${BR_FIRST}:$A${BR_LAST},{HAR})=0))',
     "Must be zero. A red cell with no benefit-risk record behind it is the finding."),
    ("Benefit-risk records that are not complete", f'=COUNTIFS({BRR}!$A${BR_FIRST}:$A${BR_LAST},"<>",{BRR}!$L${BR_FIRST}:$L${BR_LAST},"<>Complete")',
     "A benefit stated without magnitude, probability and duration is not weighable against a risk."),
    ("Category 3 controls with no disclosure reference", f'=COUNTIFS({HA}!$Q${HA_FIRST}:$Q${HA_LAST},3,{HA}!$Z${HA_FIRST}:$Z${HA_LAST},"")',
     "If safety rests on information, Clause 8 requires the significant residual risk to be disclosed in the accompanying information."),
    ("Overall residual risk inputs recorded as considered", f'={OV_DONE_COUNT} & " of {OV_N}"',
     "Clause 8. Each input on the 'Residual Risk' sheet has to be considered and the consideration recorded."),
], r)

r = blk("Production and post-production (Clause 10)", [
    ("Items logged", f'=COUNTA({PPR}!$A${PP_FIRST}:$A${PP_LAST})',
     "An empty log on a marketed device is a finding on its own."),
    ("Items open", f'=COUNTIFS({PPR}!$A${PP_FIRST}:$A${PP_LAST},"<>",{PPR}!$S${PP_FIRST}:$S${PP_LAST},"<>Closed")', "In work or open."),
    ("Items overdue", f'=COUNTIF({PPR}!$R${PP_FIRST}:$R${PP_LAST},"OVERDUE")', "Past the due date and not closed."),
    ("Items whose check is not OK", f'=COUNTIFS({PPR}!$A${PP_FIRST}:$A${PP_LAST},"<>",{PPR}!$R${PP_FIRST}:$R${PP_LAST},"<>OK")',
     "Includes overdue items and Clause 10.3 questions left unanswered."),
    ("Items that should have updated the risk file but did not", f'=COUNTIF({PPR}!$R${PP_FIRST}:$R${PP_LAST},"Risk file rows not updated")',
     "The loop that Clause 10 exists to close."),
], r)

r = blk("File", [
    ("Hazard rows whose completeness check is not Complete", f'=COUNTIFS({HAR},"<>",{HA}!$X${HA_FIRST}:$X${HA_LAST},"<>Complete")',
     "Column X on 'Hazard Analysis' names the reason for each one."),
    ("Risk control rows whose completeness check is not Complete", f'=COUNTIFS({RCS}!$A${RC_FIRST}:$A${RC_LAST},"<>",{RCS}!$L${RC_FIRST}:$L${RC_LAST},"<>Complete")',
     "Column L on 'Risk Controls'."),
    ("Risk management file index", f"='RM File Index'!$D${IX_DONE_ROW}",
     "Clause 4.5. The index is what makes a set of scattered records a file."),
], r)

# ---- exit criteria ----
ws.cell(row=r, column=1, value="Exit criteria").font = Font(name=FONT, bold=True, size=11, color=NAVY)
r += 1
ws.cell(row=r, column=1, value="Every criterion must read Yes before the risk management report is signed under Clause 9.").font = Font(name=FONT, size=9, italic=True, color=GREY)
r += 1
for i, h in enumerate(["Criterion", "Met?", "Why it matters"], start=1):
    ws.cell(row=r, column=i, value=h)
style_header(ws, r, 3, height=18)
r += 1
# resolve the dashboard rows the exit criteria depend on
def B(label):
    return f"$B${ROW_OF[label]}"

EXIT = [
    ("Every unacceptable initial risk has a risk control measure",
     f'=IF({B("...of which no risk control is recorded")}=0,"Yes","No - " & {B("...of which no risk control is recorded")} & " outstanding")',
     "Clause 7.1. Until this reads Yes the risk control activity is not finished."),
    ("Every risk control measure has both verifications",
     f'=IF({B("Controls with implementation not verified")}+{B("Controls with EFFECTIVENESS not verified")}=0,"Yes",'
     f'"No - " & ({B("Controls with implementation not verified")}+{B("Controls with EFFECTIVENESS not verified")}) & " missing")',
     "Clause 7.2. Implementation and effectiveness are two separate records."),
    ("Every unacceptable residual risk has a complete benefit-risk record",
     f'=IF({B("...with no benefit-risk record")}+{B("Benefit-risk records that are not complete")}=0,"Yes",'
     f'"No - " & ({B("...with no benefit-risk record")}+{B("Benefit-risk records that are not complete")}) & " outstanding")',
     "Clause 7.4 and Clause 8; MDR Annex I points 1 and 8."),
    ("The overall residual risk has been evaluated against the declared criteria",
     f'=IF({OV_CONCLUSION}="","No",'
     f'IF({OV_DONE_COUNT}<{OV_N},"No - " & ({OV_N}-{OV_DONE_COUNT}) & " inputs not considered","Yes"))',
     "Clause 8. A separate evaluation with its own criteria, not a roll-up of the rows."),
    ("Traceability is complete on every row",
     f'=IF({B("Hazard rows whose completeness check is not Complete")}+{B("Risk control rows whose completeness check is not Complete")}=0,"Yes",'
     f'"No - " & ({B("Hazard rows whose completeness check is not Complete")}+{B("Risk control rows whose completeness check is not Complete")}) & " rows incomplete")',
     "Clause 4.5. Columns X on 'Hazard Analysis' and L on 'Risk Controls' name the reason for each."),
    ("The production and post-production loop is current",
     f'=IF({B("Items open")}+{B("Items overdue")}=0,"Yes","No - " & ({B("Items open")}+{B("Items overdue")}) & " open or overdue")',
     "Clause 10. This is the criterion that expires; re-check it at every review."),
]
EXIT_FIRST = r
for i, (lab, f, note) in enumerate(EXIT):
    ws.cell(row=r, column=1, value=lab)
    ws.cell(row=r, column=2, value=f)
    ws.cell(row=r, column=3, value=note)
    body(ws, r, 3, fill=TINT2 if i % 2 else None, height=max(22, 11 * (1 + len(note) // 72)))
    ws.cell(row=r, column=1).font = Font(name=FONT, size=9, bold=True)
    ws.cell(row=r, column=2).font = Font(name=FONT, size=9, bold=True, color=NAVY)
    ws.cell(row=r, column=2).alignment = Alignment(horizontal="center", vertical="center")
    ws.cell(row=r, column=3).font = Font(name=FONT, size=8.5, italic=True, color=GREY)
    r += 1
EXIT_LAST = r - 1
DASH_EXIT = (EXIT_FIRST, EXIT_LAST)
ws.sheet_view.showGridLines = False
print_setup(ws, 3, landscape=False)

out = "out/ISO-14971-Risk-File-Toolkit.xlsx"
import os
os.makedirs("out", exist_ok=True)
wb.save(out)
print("wrote", out, "sheets:", wb.sheetnames)
print("exit rows", DASH_EXIT, "| overall inputs", OV_DONE_COUNT, "| index row", IX_DONE_ROW)
