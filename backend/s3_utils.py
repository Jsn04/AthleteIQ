import logging
import os

import boto3
from botocore.exceptions import BotoCoreError, ClientError

log = logging.getLogger(__name__)

_S3_ENABLED = bool(
    os.environ.get("AWS_ACCESS_KEY_ID")
    and os.environ.get("AWS_SECRET_ACCESS_KEY")
    and os.environ.get("AWS_S3_BUCKET")
)


def _client():
    return boto3.client(
        "s3",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
        region_name=os.environ.get("AWS_REGION", "ap-south-1"),
    )


def s3_enabled() -> bool:
    return _S3_ENABLED


def upload_pdf(pdf_bytes: bytes, s3_key: str) -> str:
    """Upload PDF bytes to S3. Returns the s3_key on success."""
    bucket = os.environ["AWS_S3_BUCKET"]
    try:
        _client().put_object(
            Bucket=bucket,
            Key=s3_key,
            Body=pdf_bytes,
            ContentType="application/pdf",
        )
        log.info("Uploaded PDF to s3://%s/%s", bucket, s3_key)
        return s3_key
    except (BotoCoreError, ClientError) as exc:
        log.error("S3 upload failed for key %s: %s", s3_key, exc)
        raise


def presigned_url(s3_key: str, expires_in: int = 604800) -> str:
    """Generate a pre-signed GET URL valid for `expires_in` seconds (default 7 days)."""
    bucket = os.environ["AWS_S3_BUCKET"]
    try:
        url = _client().generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": s3_key},
            ExpiresIn=expires_in,
        )
        return url
    except (BotoCoreError, ClientError) as exc:
        log.error("Pre-sign failed for key %s: %s", s3_key, exc)
        raise
