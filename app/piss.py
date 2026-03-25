from fastapi import FastAPI


def create_app (ass=None) -> FastAPI:
    print(f"ass={ass}")
    app = FastAPI()

    @app.get("/")
    async def root():
        return {"message": "Hello World"}

    return app


print(__name__)
