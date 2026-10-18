#!/usr/bin/env python3
"""
Presigns the phone lock test's three links and writes them as JSON on
stdout, for spike/phone-tool.mjs to pack into the phone URL. Throwaway, like
the rest of the spike. `spike/make-test-bucket.sh phone` runs it with its
output piped straight into phone-tool.mjs: the output holds credentials, so
never let it reach a terminal, a file or a log.

  phone-presign.py --bucket B --run R --track-key K [--expires 3600]
                   [--placeholder-credentials [--placeholder-token-chars 980]]
                   [--endpoint http://127.0.0.1:8788]

The links: t, GET the lock track; p, PUT spike/results/<run>/page.json;
w, PUT spike/results/<run>/worker.json. The aws CLI's `s3 presign` signs
only GET, hence boto3. The PUTs sign no Content-Type, so the page and the
worker can send application/json without it being part of the signature;
the bucket's CORS rule must allow the Content-Type header.

--placeholder-credentials signs with made-up keys (DRY_RUN=1 and local
tests), so the links work nowhere and no AWS session is needed.
--endpoint signs path-style links for a local stand-in for S3.

The output: {"run", "signedAt", "expiresAt", "credentialsExpireAt",
"requestedExpiresS", "placeholder", "links": {role: {"method", "url"}}},
times in epoch seconds. expiresAt is the earlier of the links' own expiry
and the end of the credentials' session.
"""

import argparse
import base64
import json
import secrets
import sys
import time

try:
    import boto3
    from botocore.config import Config
except ImportError:
    sys.exit("phone-presign.py: boto3 is not installed for this Python (see spike/make-test-bucket.sh phone)")


def placeholder_session(token_chars):
    # A made-up session token as long as a real SSO one, in the same
    # alphabet, so the phone URL's length is realistic.
    token = base64.b64encode(secrets.token_bytes(token_chars)).decode()[:token_chars]
    return boto3.session.Session(
        aws_access_key_id="ASIAPLACEHOLDER00000",
        aws_secret_access_key="placeholder-secret-not-a-key",
        aws_session_token=token,
        region_name="us-east-1",
    )


def credentials_expiry(session):
    """When the session's credentials end (epoch seconds), or None if they do not say."""
    creds = session.get_credentials()
    if creds is None:
        sys.exit("phone-presign.py: no AWS credentials; run: aws sso login --profile wxyc-api")
    creds.get_frozen_credentials()  # loads, and if need be refreshes, them now
    expiry = getattr(creds, "_expiry_time", None)
    return expiry.timestamp() if expiry is not None else None


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--bucket", required=True)
    ap.add_argument("--run", required=True)
    ap.add_argument("--track-key", required=True)
    ap.add_argument("--expires", type=int, default=3600)
    ap.add_argument("--placeholder-credentials", action="store_true")
    ap.add_argument("--placeholder-token-chars", type=int, default=980)
    ap.add_argument("--endpoint", default=None)
    args = ap.parse_args()

    if args.placeholder_credentials:
        session = placeholder_session(args.placeholder_token_chars)
        cred_expiry = None
    else:
        session = boto3.session.Session(region_name="us-east-1")
        cred_expiry = credentials_expiry(session)

    config = {"signature_version": "s3v4"}
    if args.endpoint:
        config["s3"] = {"addressing_style": "path"}
    s3 = session.client("s3", endpoint_url=args.endpoint, config=Config(**config))

    signed_at = time.time()

    def presign(method, key):
        op = "get_object" if method == "GET" else "put_object"
        url = s3.generate_presigned_url(op, Params={"Bucket": args.bucket, "Key": key}, ExpiresIn=args.expires, HttpMethod=method)
        return {"method": method, "url": url}

    results = f"spike/results/{args.run}"
    expires_at = signed_at + args.expires
    if cred_expiry is not None:
        expires_at = min(expires_at, cred_expiry)
    json.dump(
        {
            "run": args.run,
            "signedAt": int(signed_at),
            "expiresAt": int(expires_at),
            "credentialsExpireAt": int(cred_expiry) if cred_expiry is not None else None,
            "requestedExpiresS": args.expires,
            "placeholder": bool(args.placeholder_credentials),
            "links": {
                "t": presign("GET", args.track_key),
                "p": presign("PUT", f"{results}/page.json"),
                "w": presign("PUT", f"{results}/worker.json"),
            },
        },
        sys.stdout,
    )


if __name__ == "__main__":
    main()
