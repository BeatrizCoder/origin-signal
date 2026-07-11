from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

client = AsyncIOMotorClient(settings.mongo_uri)
db = client['originsignal']
analyses_collection = db['analyses']


async def save_analysis(data: dict) -> str:
    from datetime import datetime
    import uuid
    record = {
        '_id': str(uuid.uuid4()),
        'created_at': datetime.utcnow(),
        'commodity': data.get('commodity'),
        'origin': data.get('origin'),
        'destination': data.get('destination'),
        'trade_direction': data.get('trade_direction', 'export'),
        'overall_risk_score': data.get('overall_risk_score'),
        'export_readiness': data.get('export_readiness'),
        'risk_level': data.get('risk_level'),
        'query': data.get('query', ''),
        'executive_summary': data.get('executive', {}).get('executive_summary', ''),
        'overall_verdict': data.get('executive', {}).get('overall_verdict', ''),
        'regulatory_score': data.get('regulatory', {}).get('risk_score', 0),
        'climate_score': data.get('climate', {}).get('climate_risk_score', 0),
        'market_score': data.get('market', {}).get('market_risk_score', 0),
        'logistics_score': data.get('logistics', {}).get('logistics_risk_score', 0),
        'tariff_score': data.get('tariff', {}).get('tariff_risk_score', 0),
        'full_result': data
    }
    await analyses_collection.insert_one(record)
    return record['_id']


async def get_analyses(limit: int = 20) -> list:
    cursor = analyses_collection.find(
        {},
        {'full_result': 0}  # exclui o campo pesado
    ).sort('created_at', -1).limit(limit)
    results = []
    async for doc in cursor:
        doc['id'] = doc.pop('_id')
        doc['created_at'] = doc['created_at'].isoformat()
        results.append(doc)
    return results


async def get_analysis_by_id(analysis_id: str) -> dict:
    doc = await analyses_collection.find_one({'_id': analysis_id})
    if doc:
        doc['id'] = doc.pop('_id')
        doc['created_at'] = doc['created_at'].isoformat()
    return doc
