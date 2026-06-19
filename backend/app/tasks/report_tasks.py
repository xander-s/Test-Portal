import asyncio
from datetime import datetime
import os
from io import BytesIO
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from app.core.celery_app import celery_app
from app.core.database import async_session_maker
from app.core.s3 import s3_storage
from app.models.models import TestAttempt, Student, User, Assessment, Result, Certificate, Report
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

async def _generate_pdf_report_async(attempt_id: str):
    async with async_session_maker() as session:
        # Fetch attempt info
        stmt = select(TestAttempt).options(
            selectinload(TestAttempt.student).selectinload(Student.user),
            selectinload(TestAttempt.assessment),
            selectinload(TestAttempt.result)
        ).where(TestAttempt.id == attempt_id)
        
        res = await session.execute(stmt)
        attempt = res.scalars().first()
        if not attempt or not attempt.result:
            print(f"Attempt {attempt_id} or result not found. Skipping PDF generation.")
            return

        # Setup ReportLab Doc
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
        story = []
        
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=24,
            textColor=colors.HexColor('#4F46E5'),
            spaceAfter=12
        )
        body_style = styles['Normal']
        
        story.append(Paragraph("Assessment Performance Report", title_style))
        story.append(Spacer(1, 12))
        
        # Details Table
        data = [
            [Paragraph("<b>Candidate Name:</b>", body_style), Paragraph(attempt.student.user.full_name, body_style),
             Paragraph("<b>Assessment Title:</b>", body_style), Paragraph(attempt.assessment.title, body_style)],
            [Paragraph("<b>Started At:</b>", body_style), Paragraph(attempt.started_at.strftime('%Y-%m-%d %H:%M:%S'), body_style),
             Paragraph("<b>Submitted At:</b>", body_style), Paragraph(attempt.submitted_at.strftime('%Y-%m-%d %H:%M:%S') if attempt.submitted_at else "N/A", body_style)],
            [Paragraph("<b>Total Score:</b>", body_style), Paragraph(f"{attempt.result.total_score} / {attempt.assessment.total_marks}", body_style),
             Paragraph("<b>Percentage:</b>", body_style), Paragraph(f"{attempt.result.percentage:.2f}%", body_style)],
            [Paragraph("<b>Result Status:</b>", body_style), Paragraph("PASSED" if attempt.result.pass_fail else "FAILED", body_style),
             Paragraph("<b>AI Proctor Violations:</b>", body_style), Paragraph(str(attempt.violation_count), body_style)]
        ]
        
        t = Table(data, colWidths=[110, 150, 110, 150])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F8FAFC')),
            ('GRID', (0,0), (-1,-1), 1, colors.HexColor('#E2E8F0')),
            ('PADDING', (0,0), (-1,-1), 8),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        
        story.append(t)
        story.append(Spacer(1, 20))
        
        doc.build(story)
        
        buffer.seek(0)
        pdf_bytes = buffer.getvalue()
        
        filename = f"organizations/{attempt.student.organization_id}/attempts/{attempt_id}/reports/report.pdf"
        s3_url = s3_storage.upload_file(pdf_bytes, filename, content_type="application/pdf")
        
        # Save Report URL to database
        report = Report(
            attempt_id=attempt_id,
            file_url=s3_url
        )
        session.add(report)
        await session.commit()
        print(f"PDF report generated successfully for attempt {attempt_id}: {s3_url}")

async def _generate_certificate_async(attempt_id: str):
    async with async_session_maker() as session:
        # Fetch attempt
        stmt = select(TestAttempt).options(
            selectinload(TestAttempt.student).selectinload(Student.user),
            selectinload(TestAttempt.assessment),
            selectinload(TestAttempt.result)
        ).where(TestAttempt.id == attempt_id)
        
        res = await session.execute(stmt)
        attempt = res.scalars().first()
        if not attempt or not attempt.result or not attempt.result.pass_fail:
            print(f"Attempt {attempt_id} ineligible for certificate.")
            return

        # Setup ReportLab Doc in Landscape
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=landscape(letter), rightMargin=54, leftMargin=54, topMargin=54, bottomMargin=54)
        story = []
        
        styles = getSampleStyleSheet()
        cert_title = ParagraphStyle(
            'CertTitle',
            parent=styles['Heading1'],
            fontName='Helvetica-Bold',
            fontSize=32,
            textColor=colors.HexColor('#1E293B'),
            alignment=1, # Center
            spaceAfter=24
        )
        cert_body = ParagraphStyle(
            'CertBody',
            parent=styles['Normal'],
            fontName='Helvetica',
            fontSize=16,
            textColor=colors.HexColor('#475569'),
            alignment=1, # Center
            spaceAfter=12
        )
        
        story.append(Spacer(1, 40))
        story.append(Paragraph("CERTIFICATE OF COMPLETION", cert_title))
        story.append(Spacer(1, 12))
        story.append(Paragraph("This is proudly presented to", cert_body))
        
        name_style = ParagraphStyle(
            'NameStyle',
            parent=cert_body,
            fontName='Helvetica-Bold',
            fontSize=24,
            textColor=colors.HexColor('#4F46E5')
        )
        story.append(Paragraph(attempt.student.user.full_name, name_style))
        story.append(Spacer(1, 12))
        story.append(Paragraph(f"for successfully passing the assessment", cert_body))
        
        assess_style = ParagraphStyle(
            'AssessStyle',
            parent=cert_body,
            fontName='Helvetica-Bold',
            fontSize=20,
            textColor=colors.HexColor('#0F172A')
        )
        story.append(Paragraph(attempt.assessment.title, assess_style))
        story.append(Spacer(1, 12))
        
        date_str = datetime.utcnow().strftime('%B %d, %Y')
        story.append(Paragraph(f"Issued on: {date_str}", cert_body))
        
        doc.build(story)
        buffer.seek(0)
        cert_bytes = buffer.getvalue()
        
        cert_number = f"CERT-{attempt_id[:8].upper()}-{datetime.utcnow().year}"
        filename = f"organizations/{attempt.student.organization_id}/students/{attempt.student_id}/certificates/{cert_number}.pdf"
        s3_url = s3_storage.upload_file(cert_bytes, filename, content_type="application/pdf")
        
        certificate = Certificate(
            student_id=attempt.student_id,
            assessment_id=attempt.assessment_id,
            certificate_number=cert_number,
            file_url=s3_url,
            issue_date=datetime.utcnow()
        )
        session.add(certificate)
        await session.commit()
        print(f"Certificate {cert_number} generated successfully: {s3_url}")

@celery_app.task(name="generate_attempt_pdf_report")
def generate_attempt_pdf_report(attempt_id: str):
    asyncio.run(_generate_pdf_report_async(attempt_id))

@celery_app.task(name="generate_certificate_task")
def generate_certificate_task(attempt_id: str):
    asyncio.run(_generate_certificate_async(attempt_id))

@celery_app.task(name="send_email_notification_task")
def send_email_notification_task(email: str, subject: str, body: str):
    # Mock SMTP email sender
    print(f"Sending Email to {email} | Subject: {subject} | Body: {body}")
