from __future__ import annotations

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    db_host: str = Field(default="db", alias="DB_HOST")
    db_user: str = Field(default="app", alias="DB_USER")
    db_password: str = Field(default="app", alias="DB_PASSWORD")
    db_port: int = Field(default=5432, alias="DB_PORT")
    db_name: str = Field(default="app", alias="DB_NAME")

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @computed_field
    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


settings = Settings()
