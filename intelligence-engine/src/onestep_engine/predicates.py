"""Three-valued evaluation of reviewer-authored predicates; policy values remain data."""

import numbers


OPERATORS = {'eq', 'in', 'gte', 'lte', 'exists'}


def validate_predicate(expression, depth=0):
    if depth > 8 or not isinstance(expression, dict):
        raise ValueError('invalid policy predicate')
    if set(expression) == {'all'} or set(expression) == {'any'}:
        children = expression.get('all', expression.get('any'))
        if not isinstance(children, list) or not 1 <= len(children) <= 30:
            raise ValueError('predicate group must contain 1 to 30 conditions')
        for child in children:
            validate_predicate(child, depth + 1)
        return
    if expression.get('operator') not in OPERATORS or not isinstance(expression.get('field'), str):
        raise ValueError('unsupported predicate operator or missing field')
    if expression['operator'] != 'exists' and 'value' not in expression:
        raise ValueError('predicate value required')
    if expression['operator'] == 'in' and not isinstance(expression['value'], list):
        raise ValueError('in predicate requires a list')
    if expression['operator'] in ('gte', 'lte') and (not isinstance(expression['value'], numbers.Real) or isinstance(expression['value'], bool)):
        raise ValueError('numeric comparison requires a numeric value')


def evaluate(expression, profile):
    validate_predicate(expression)
    if 'all' in expression:
        values = [evaluate(item, profile) for item in expression['all']]
        return False if False in values else (None if None in values else True)
    if 'any' in expression:
        values = [evaluate(item, profile) for item in expression['any']]
        return True if True in values else (None if None in values else False)
    value = profile
    for part in expression['field'].split('.'):
        if not isinstance(value, dict) or part not in value:
            return False if expression['operator'] == 'exists' else None
        value = value[part]
    op = expression['operator']
    if op == 'exists':
        return value is not None
    if value is None:
        return None
    expected = expression['value']
    if op == 'eq':
        return type(value) is type(expected) and value == expected
    if op == 'in':
        return any(type(value) is type(item) and value == item for item in expected)
    if not isinstance(value, numbers.Real) or isinstance(value, bool):
        return None
    return value >= expected if op == 'gte' else value <= expected


def assess_rule(payload: dict, profile: dict) -> str:
    if 'predicate' not in payload:
        return 'context_only'
    result = evaluate(payload['predicate'], profile)
    return 'requires_information' if result is None else ('conditions_met' if result else 'conditions_not_met')
