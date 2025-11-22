# utils/roles.py
from typing import Iterable, List

ROLE_ORDER = ["admin", "manager", "operator", "resident"]

def normalize_roles(roles: Iterable[str], drop_resident_if_admin: bool = True) -> List[str]:
    """
    1) Приводим к нижнему регистру, убираем дубли
    2) Если есть admin — по умолчанию убираем resident (флаг drop_resident_if_admin)
    3) Сортируем по приоритету: admin → manager → operator → resident → остальные
    """
    s = {str(r).lower().strip() for r in roles if r}
    if "admin" in s and drop_resident_if_admin:
        s.discard("resident")

    prioritized = [r for r in ROLE_ORDER if r in s]
    rest = sorted([r for r in s if r not in ROLE_ORDER])
    return prioritized + rest