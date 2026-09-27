from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Meeting, MoMDocument, MeetingAnalytics
from ..schemas import MoMDocumentResponse, MeetingAnalyticsResponse
from ..services.mom_service import mom_service
from ..services.analytics_service import analytics_service

router = APIRouter(prefix="/api/meetings/{code}", tags=["MoM & Analytics"])

@router.get("/mom", response_model=MoMDocumentResponse)
def get_mom(code: str, db: Session = Depends(get_db)):
    """Retrieve generated MoM markdown and html document."""
    meeting = db.query(Meeting).filter(Meeting.code == code.upper().strip()).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    mom_doc = db.query(MoMDocument).filter(MoMDocument.meeting_id == meeting.id).first()
    if not mom_doc:
        # If not generated yet, try generating on-the-fly
        mom_service.generate_mom(meeting.id, db)
        mom_doc = db.query(MoMDocument).filter(MoMDocument.meeting_id == meeting.id).first()

    if not mom_doc:
        raise HTTPException(status_code=404, detail="MoM not available yet. Please end meeting first.")

    return mom_doc

@router.get("/mom/export/markdown")
def export_mom_markdown(code: str, db: Session = Depends(get_db)):
    """Export MoM document as a downloadable .md file."""
    meeting = db.query(Meeting).filter(Meeting.code == code.upper().strip()).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    mom_doc = db.query(MoMDocument).filter(MoMDocument.meeting_id == meeting.id).first()
    if not mom_doc:
        mom_service.generate_mom(meeting.id, db)
        mom_doc = db.query(MoMDocument).filter(MoMDocument.meeting_id == meeting.id).first()

    md_content = mom_doc.markdown_content if mom_doc else "# Empty MoM"
    return Response(
        content=md_content,
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename=MoM_{meeting.code}.md"}
    )

@router.get("/analytics", response_model=MeetingAnalyticsResponse)
def get_analytics(code: str, db: Session = Depends(get_db)):
    """Retrieve meeting analytics."""
    meeting = db.query(Meeting).filter(Meeting.code == code.upper().strip()).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    analytics_doc = db.query(MeetingAnalytics).filter(MeetingAnalytics.meeting_id == meeting.id).first()
    if not analytics_doc:
        analytics_service.calculate_meeting_analytics(meeting.id, db)
        analytics_doc = db.query(MeetingAnalytics).filter(MeetingAnalytics.meeting_id == meeting.id).first()

    if not analytics_doc:
        raise HTTPException(status_code=404, detail="Analytics not available yet.")

    return analytics_doc
