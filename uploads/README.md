# Upload drawings here

For the GitHub-only AI workflow:

1. Open this `uploads` folder on GitHub.
2. Choose **Add file → Upload files**.
3. Upload one JPG, JPEG, PNG or WEBP floor-plan photo.
4. Commit the upload to `main`.
5. GitHub Actions will analyse the newest uploaded image.
6. The result is written to `results/latest.json` and the website can load it.

Before the first run, add the repository secret `OPENAI_API_KEY` under:

**Settings → Secrets and variables → Actions → New repository secret**

Do not put the API key in the image, source code, issue text or any browser-side JavaScript.
