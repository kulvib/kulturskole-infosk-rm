"""Add all new fields to client table

Revision ID: 20250805_add_all_client_fields
Revises: 
Create Date: 2025-08-05 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision = '20250805_add_all_client_fields'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('client')]

    # Add columns only if they don't already exist!
    if 'kiosk_url' not in columns:
        op.add_column('client', sa.Column('kiosk_url', sa.String(), nullable=True))
    if 'ubuntu_version' not in columns:
        op.add_column('client', sa.Column('ubuntu_version', sa.String(), nullable=True))
    if 'uptime' not in columns:
        op.add_column('client', sa.Column('uptime', sa.String(), nullable=True))
    if 'wifi_ip_address' not in columns:
        op.add_column('client', sa.Column('wifi_ip_address', sa.String(), nullable=True))
    if 'wifi_mac_address' not in columns:
        op.add_column('client', sa.Column('wifi_mac_address', sa.String(), nullable=True))
    if 'lan_ip_address' not in columns:
        op.add_column('client', sa.Column('lan_ip_address', sa.String(), nullable=True))
    if 'lan_mac_address' not in columns:
        op.add_column('client', sa.Column('lan_mac_address', sa.String(), nullable=True))

def downgrade():
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('client')]

    # Drop columns only if they exist!
    if 'kiosk_url' in columns:
        op.drop_column('client', 'kiosk_url')
    if 'ubuntu_version' in columns:
        op.drop_column('client', 'ubuntu_version')
    if 'uptime' in columns:
        op.drop_column('client', 'uptime')
    if 'wifi_ip_address' in columns:
        op.drop_column('client', 'wifi_ip_address')
    if 'wifi_mac_address' in columns:
        op.drop_column('client', 'wifi_mac_address')
    if 'lan_ip_address' in columns:
        op.drop_column('client', 'lan_ip_address')
    if 'lan_mac_address' in columns:
        op.drop_column('client', 'lan_mac_address')
