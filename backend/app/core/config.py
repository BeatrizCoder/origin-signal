from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    anthropic_api_key: str = ""
    mongo_uri: str = "mongodb://localhost:27017/originsignal"
    open_meteo_base_url: str = "https://api.open-meteo.com/v1"
    weather_api_key: Optional[str] = None
    usda_fas_base_url: str = "https://apps.fas.usda.gov/psdonline/api/v1"
    commodity: str = "coffee"


settings = Settings()
