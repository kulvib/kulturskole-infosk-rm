"""Add kiosk_url, ubuntu_version, and uptime columns to client table

Revision ID: 20250802_add_kiosk_url_ubuntu_version_uptime_to_client
Revises: 
Create Date: 2025-08-02 16:22:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20250802_add_kiosk_url_ubuntu_version_uptime_to_client'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('client', sa.Column('kiosk_url', sa.String(), nullable=True))
    op.add_column('client', sa.Column('ubuntu_version', sa.String(), nullable=True))
    op.add_column('client', sa.Column('uptime', sa.String(), nullable=True))

def downgrade():
    op.drop_column('client', 'kiosk_url')
    op.drop_column('client', 'ubuntu_version')
    op.drop_column('client', 'uptime')
