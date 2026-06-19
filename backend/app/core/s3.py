import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from app.core.config import settings

class S3Storage:
    def __init__(self):
        # Determine protocol prefix
        endpoint = settings.MINIO_ENDPOINT
        if not endpoint.startswith("http://") and not endpoint.startswith("https://"):
            endpoint = f"http://{endpoint}"
            
        self.s3_client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
            config=Config(signature_version="s3v4"),
            region_name="us-east-1"
        )
        self.bucket_name = settings.MINIO_BUCKET_NAME
        self._ensure_bucket_exists()

    def _ensure_bucket_exists(self):
        try:
            self.s3_client.head_bucket(Bucket=self.bucket_name)
        except Exception as e:
            try:
                self.s3_client.create_bucket(Bucket=self.bucket_name)
            except Exception as ex:
                print(f"Warning: Object storage (S3/MinIO) is not reachable: {ex}")

    def upload_file(self, file_data, object_name: str, content_type: str = "application/octet-stream") -> str:
        """
        Uploads a file bytes or object stream to the MinIO/S3 bucket.
        """
        try:
            self.s3_client.put_object(
                Bucket=self.bucket_name,
                Key=object_name,
                Body=file_data,
                ContentType=content_type
            )
            # Generate static or presigned access URL
            return self.generate_presigned_url(object_name)
        except ClientError as e:
            print(f"Failed to upload file to S3: {e}")
            raise e

    def generate_presigned_url(self, object_name: str, expiration: int = 86400) -> str:
        """
        Generates a secure, temporary pre-signed URL to access private media.
        """
        try:
            url = self.s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket_name, "Key": object_name},
                ExpiresIn=expiration
            )
            return url
        except ClientError as e:
            print(f"Failed to generate presigned URL: {e}")
            return ""

s3_storage = S3Storage()
